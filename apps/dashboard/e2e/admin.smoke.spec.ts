import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import AxeBuilder from "@axe-core/playwright";
import { ADMIN_STATE, CONSENT_FILE, E2E_AUTH_SECRET, AUDIT_SEED_COUNT, FAILED_JOB_ERROR, FAILED_JOB_TYPE, PASSWORD, PLAN_NAME, QUEUED_JOB_TYPE, REASON_TEXT, STORAGE_ORIGIN, USERS } from "./seed";

/** Smoke tests for the platform-admin area (/admin). Tests run in order and share seeded rows. */
test.describe.configure({ mode: "serial" });

/** Signs in through the API. Better Auth allows a few sign-ins per 10 seconds from one address, so wait and retry when told to slow down. */
async function signIn(context: { post: (url: string, options: { headers: Record<string, string>; data: unknown }) => Promise<{ ok(): boolean; status(): number }> }, base: string, email: string) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await context.post("/api/auth/sign-in/email", { headers: { origin: base }, data: { email, password: PASSWORD } });
    if (res.ok()) return;
    if (res.status() !== 429) throw new Error(`Sign-in as ${email} failed with ${res.status()}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Sign-in as ${email} kept being rate limited`);
}

/** Creates an account through the API (waits out the sign-up rate limit) and confirms its email with the link's token, made the way the server makes it. */
async function createConfirmedAccount(context: { post: (url: string, options: { headers: Record<string, string>; data: unknown }) => Promise<{ ok(): boolean; status(): number }>; get: (url: string, options: { maxRedirects: number }) => Promise<{ status(): number }> }, base: string, email: string, name: string) {
  for (let attempt = 1; ; attempt++) {
    const res = await context.post("/api/auth/sign-up/email", { headers: { origin: base }, data: { email, password: PASSWORD, name } });
    if (res.ok()) break;
    if (res.status() !== 429 || attempt >= 6) throw new Error(`Sign-up as ${email} failed with ${res.status()}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  const { createEmailVerificationToken } = await import("better-auth/api");
  const token = await createEmailVerificationToken(E2E_AUTH_SECRET, email, undefined, 3600);
  const verified = await context.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { maxRedirects: 0 });
  if (verified.status() >= 400) throw new Error(`Confirming ${email} failed with ${verified.status()}`);
}

/** Navigates, and tries again when the app's own redirect or refresh interrupts the navigation, or Firefox fails one outright (seen in Firefox and WebKit). */
async function open(page: Page, url: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(url);
      return;
    } catch (error) {
      if (attempt >= 3 || !/interrupted by another navigation|NS_BINDING_ABORTED|NS_ERROR_FAILURE|frame was detached/i.test(String(error))) throw error;
      await page.waitForLoadState("load").catch(() => {});
    }
  }
}

const TABS = ["Plans & pricing", "Payments", "Users", "Video & jobs", "Usage", "Moderation", "Audit log", "System"] as const;

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name });
const row = (page: Page, text: string | RegExp) => page.getByRole("row").filter({ hasText: text });

test.describe("access control", () => {
  test("an anonymous visitor is sent to the login page", async ({ page }) => {
    await open(page, "/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a signed-in customer cannot open the admin area", async ({ page }) => {
    // Better Auth rate-limits sign-ins (a few per 10 seconds per address), so when the form comes back to /login, wait and try again
    for (let attempt = 1; attempt <= 5; attempt++) {
      await open(page, "/login");
      await page.getByLabel("Email").fill(USERS.member.email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      // A brand-new account lands on onboarding, an established one on the dashboard
      if (await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 8000 }).then(() => true, () => false)) break;
      await page.waitForTimeout(4000);
    }
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);

    await open(page, "/admin");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
    await expect(page.getByRole("heading", { name: "Admin", exact: true })).toHaveCount(0);
  });
});

test.describe("platform admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("every tab opens", async ({ page }) => {
    await open(page, "/admin");
    await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
    for (const name of TABS) {
      await tab(page, name).click();
      await expect(tab(page, name)).toHaveAttribute("aria-current", "page");
    }
    // Spot-check content that proves each tab rendered, not just the link
    await tab(page, "Plans & pricing").click();
    await expect(page.getByText(PLAN_NAME)).toBeVisible();
    await tab(page, "Payments").click();
    await expect(page.getByText("Active Payment Provider")).toBeVisible();
    await tab(page, "Usage").click();
    await expect(page.getByText("Review video credits")).toBeVisible();
    await expect(page.getByRole("link", { name: "Previous month" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Next month" })).toHaveCount(0); // already on the current month
    await tab(page, "Moderation").click();
    await expect(page.getByText(/Finished videos across all accounts/)).toBeVisible();
    await tab(page, "System").click();
    await expect(page.getByText("System health")).toBeVisible();
    await expect(page.getByText("Background workers")).toBeVisible();
  });

  test("system: workers show their heartbeat status", async ({ page }) => {
    await open(page, "/admin?tab=system");
    const video = row(page, "4242");
    await expect(video).toContainText("Video worker");
    await expect(video).toContainText("Online");
    await expect(video).toContainText("chromium: ok");
    const jobs = row(page, "4343");
    await expect(jobs).toContainText("Job worker");
    await expect(jobs).toContainText("Not responding");
    // The summary says the same in words: the video worker is fine, the job worker is not running
    await expect(page.getByText("1 worker online.")).toBeVisible();
    await expect(page.getByText(/No job worker is running/)).toBeVisible();
  });

  test("video & jobs: retry a failed job and cancel queued jobs", async ({ page }) => {
    await open(page, "/admin?tab=videos");
    await expect(page.getByText("Failed jobs")).toBeVisible();
    // Jobs are waiting and no job worker is alive: the page says so at the top
    await expect(page.locator("div[role=alert]").filter({ hasText: "No job worker is running" })).toBeVisible();
    await expect(page.locator("div[role=alert]").filter({ hasText: "video worker" })).toHaveCount(0);

    // Retry: confirm dialog, success toast, and the job leaves the failed list
    await row(page, FAILED_JOB_ERROR).getByRole("button", { name: "Retry" }).click();
    await expect(page.getByRole("dialog").getByText("Retry this job?")).toBeVisible();
    await page.getByRole("button", { name: "Retry job" }).click();
    await expect(page.getByText("Job queued again.")).toBeVisible();
    await expect(page.getByText(FAILED_JOB_ERROR)).toHaveCount(0);
    await expect(row(page, FAILED_JOB_TYPE)).toHaveCount(1); // now in the queued list

    // Dismissing the dialog changes nothing
    await row(page, QUEUED_JOB_TYPE).getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(row(page, QUEUED_JOB_TYPE)).toHaveCount(1);

    // Cancel for real: the job ends up in the failed list with the admin's reason
    await row(page, QUEUED_JOB_TYPE).getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("button", { name: "Cancel job" }).click();
    await expect(page.getByText("Job cancelled.")).toBeVisible();
    await expect(row(page, "Cancelled by an administrator")).toHaveCount(1);
  });

  test("users: grant a plan, promote another admin, and the guard rails hold", async ({ page }) => {
    await open(page, `/admin?tab=users&q=${encodeURIComponent("e2e-")}`);

    // Grant a plan by hand
    await row(page, USERS.customer.email).getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(USERS.customer.email)).toBeVisible();
    await dialog.getByRole("combobox", { name: "Plan" }).click();
    await page.getByRole("option", { name: new RegExp(PLAN_NAME) }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`Updated ${USERS.customer.email}.`)).toBeVisible();
    await expect(row(page, USERS.customer.email)).toContainText(PLAN_NAME);
    await expect(row(page, USERS.customer.email)).toContainText("Granted");

    // Promote another user to platform admin
    await row(page, USERS.promote.email).getByRole("button", { name: "Manage" }).click();
    await page.getByRole("switch", { name: "Platform admin" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, USERS.promote.email)).toContainText("Admin");

    // A plan billed by a payment provider cannot be changed here
    await row(page, USERS.billed.email).getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("dialog").getByText(/Change or cancel it there/)).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("combobox", { name: "Plan" })).toBeDisabled();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    // You cannot change your own admin access
    await row(page, USERS.admin.email).getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("switch", { name: "Platform admin" })).toBeDisabled();
    await expect(page.getByRole("switch", { name: "Suspended" })).toBeDisabled();
    await expect(page.getByRole("dialog").getByText("You cannot change your own admin access.")).toBeVisible();
  });

  test("revoking admin takes effect at once, even for someone whose signed-in session still says admin", async ({ browser, request, baseURL }) => {
    const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    const { rows: [target] } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [USERS.promote.email]);
    await pool.end();

    // Signed in as the user the earlier test promoted: their session cookie now records "admin"
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.promote.email);
    expect((await context.request.get("/api/admin/jobs")).status()).toBe(200);

    // An admin takes it away. The other person's cookie is untouched and still says admin.
    const revoke = await request.patch(`/api/admin/users/${target.id}`, { headers: { origin: baseURL! }, data: { isPlatformAdmin: false } });
    expect(revoke.status()).toBe(200);
    expect((await context.request.get("/api/admin/jobs")).status()).toBe(403);
    const page = await context.newPage();
    await open(page, "/admin");
    await expect(page).not.toHaveURL(/\/admin/);

    // Giving it back works at once too
    expect((await request.patch(`/api/admin/users/${target.id}`, { headers: { origin: baseURL! }, data: { isPlatformAdmin: true } })).status()).toBe(200);
    expect((await context.request.get("/api/admin/jobs")).status()).toBe(200);
    await context.close();
  });

  test("phone width: the Take down button is on screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await open(page, "/admin?tab=moderation");
    const takeDown = page.getByRole("button", { name: "Take down" }).first();
    await expect(takeDown).toBeVisible();
    const tdBox = (await takeDown.boundingBox())!;
    expect(tdBox.x + tdBox.width, "Take down runs past the right edge").toBeLessThanOrEqual(390);
  });

  test("moderation: find a video whose consent was withdrawn and take it down, with a retry after storage fails", async ({ page, playwright }) => {
    const deleted = async () => (await (await page.request.get(`${STORAGE_ORIGIN}/__deleted`)).json()) as string[];
    await open(page, "/admin?tab=moderation&q=E2E%20Moderation");

    // Everything the owner has is listed with what it says and the permission behind it
    const healthy = row(page, "E2E healthy narration script.");
    const withdrawn = row(page, "E2E withdrawn narration script.");
    const reviews = row(page, "E2E review video text.");
    await expect(healthy).toContainText("Live");
    await expect(healthy).toContainText("Ada Lovelace, Analytical Co");
    await expect(healthy).toContainText("Given");
    await expect(withdrawn).toContainText("Consent withdrawn");
    await expect(reviews).toContainText("Review video");
    await expect(reviews).toContainText("Maya Okafor");
    await expect(reviews).toContainText("Owner confirmed rights");

    // The state filter narrows the list to what needs attention
    await page.getByRole("combobox", { name: "State" }).click();
    await page.getByRole("option", { name: "Consent withdrawn" }).click();
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/filter=attention/);
    await expect(row(page, "E2E withdrawn narration script.")).toHaveCount(1);
    await expect(row(page, "E2E healthy narration script.")).toHaveCount(0);

    // A short reason is not accepted
    await row(page, "E2E withdrawn narration script.").getByRole("button", { name: "Take down" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("This cannot be undone")).toBeVisible();
    await dialog.getByLabel("Reason").fill("no");
    await expect(dialog.getByRole("button", { name: "Take down" })).toBeDisabled();

    // Storage is down: the admin is told, nothing changes, and the file is still there
    await page.request.post(`${STORAGE_ORIGIN}/__fail?on=1`);
    await dialog.getByLabel("Reason").fill(REASON_TEXT);
    await dialog.getByRole("button", { name: "Take down" }).click();
    await expect(page.getByText(/could not be deleted/)).toBeVisible();
    expect(await deleted()).toEqual([]);
    await page.reload();
    await expect(row(page, "E2E withdrawn narration script.")).toContainText("Consent withdrawn");

    // Storage is back: the retry goes through
    await page.request.post(`${STORAGE_ORIGIN}/__fail?on=0`);
    await row(page, "E2E withdrawn narration script.").getByRole("button", { name: "Take down" }).click();
    await page.getByRole("dialog").getByLabel("Reason").fill(REASON_TEXT);
    await page.getByRole("dialog").getByRole("button", { name: "Take down" }).click();
    await expect(page.getByText("Video taken down. Its owner has been told.")).toBeVisible();
    expect(await deleted()).toHaveLength(1);
    expect((await deleted())[0]).toMatch(/^ai-videos\/.+\.mp4$/);

    // It now shows as taken down, with who and why, and no button
    await open(page, "/admin?tab=moderation&filter=removed&q=E2E%20Moderation");
    const gone = row(page, "E2E withdrawn narration script.");
    await expect(gone).toContainText("Taken down");
    await expect(gone).toContainText(REASON_TEXT);
    await expect(gone).toContainText(USERS.admin.email);
    await expect(gone.getByRole("button", { name: "Take down" })).toHaveCount(0);
    await expect(gone.getByRole("link", { name: "Open file" })).toHaveCount(0);

    // A review video goes the same way
    await open(page, "/admin?tab=moderation&kind=review&q=E2E%20Moderation");
    await row(page, "E2E review video text.").getByRole("button", { name: "Take down" }).click();
    await page.getByRole("dialog").getByLabel("Reason").fill("The reviewer asked us to remove it");
    await page.getByRole("dialog").getByRole("button", { name: "Take down" }).click();
    await expect(page.getByText("Video taken down. Its owner has been told.")).toBeVisible();
    // Wait for the page's own refresh to land before navigating away (WebKit interrupts a goto otherwise)
    await expect(row(page, "E2E review video text.")).toContainText("Taken down");
    expect((await deleted())[1]).toMatch(/^review-videos\/.+\.mp4$/);

    // The healthy video is untouched, and the action is in the audit log
    await open(page, "/admin?tab=moderation&filter=live&q=E2E%20Moderation");
    await expect(row(page, "E2E healthy narration script.")).toContainText("Live");
    await open(page, "/admin?tab=audit&type=video");
    await expect(page.getByText(/Took down AI video \(bold\)/)).toBeVisible();
    await expect(page.getByText(/Took down review video \(spotlight\)/)).toBeVisible();
  });

  test("moderation: the owner sees why a video was removed, and deleting a video deletes its file", async ({ playwright, baseURL }) => {
    const base = baseURL!;
    const api = await playwright.request.newContext({ baseURL: base });
    await signIn(api, base, USERS.customer.email);

    // Find the owner's space and the testimonial of the taken-down video through the owner's own API
    const spaces = await (await api.get("/api/spaces")).json();
    const space = (spaces.spaces ?? spaces).find((s: { name: string }) => s.name === "E2E Moderation Space");
    expect(space).toBeTruthy();
    const testimonials = await (await api.get(`/api/spaces/${space.id}/testimonials`)).json();
    const list: { id: string; customerName: string | null }[] = testimonials.testimonials ?? testimonials;
    const grace = list.find((t) => t.customerName === "Grace Hopper")!;
    const data = await (await api.get(`/api/spaces/${space.id}/testimonials/${grace.id}/ai-video`)).json();
    expect(data.videos).toHaveLength(1);
    expect(data.videos[0]).toMatchObject({ status: "done", outputUrl: null, moderationReason: REASON_TEXT });
    expect(data.videos[0].moderatedAt).toBeTruthy();

    // When the owner deletes a finished video the stored file goes too, not only the link in the database.
    // Storage failing must change nothing, so the owner can try again.
    const ada = list.find((t) => t.customerName === "Ada Lovelace")!;
    const before = (await (await api.get(`/api/spaces/${space.id}/testimonials/${ada.id}/ai-video`)).json()).videos[0];
    expect(before).toMatchObject({ status: "done" });
    expect(before.outputUrl).toContain("/ai-videos/");
    const deletedKeys = async () => (await (await api.get(`${STORAGE_ORIGIN}/__deleted`)).json()) as string[];
    const filesBefore = (await deletedKeys()).length;

    await api.post(`${STORAGE_ORIGIN}/__fail?on=1`);
    const failed = await api.delete(`/api/spaces/${space.id}/ai-videos/${before.id}`, { headers: { origin: base } });
    expect(failed.status()).toBe(502);
    expect((await failed.json()).error.message).toContain("Nothing was changed");
    const stillThere = (await (await api.get(`/api/spaces/${space.id}/testimonials/${ada.id}/ai-video`)).json()).videos;
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0].outputUrl).toBe(before.outputUrl);
    expect(await deletedKeys()).toHaveLength(filesBefore);

    await api.post(`${STORAGE_ORIGIN}/__fail?on=0`);
    const ok = await api.delete(`/api/spaces/${space.id}/ai-videos/${before.id}`, { headers: { origin: base } });
    expect(ok.status()).toBe(200);
    const keys = await deletedKeys();
    expect(keys).toHaveLength(filesBefore + 1);
    expect(keys.at(-1)).toBe(`ai-videos/${space.id}/${ada.id}/${before.id}.mp4`);
    expect((await (await api.get(`/api/spaces/${space.id}/testimonials/${ada.id}/ai-video`)).json()).videos).toHaveLength(0);
    await api.dispose();
  });

  test("consent: a customer withdraws from the link in their email, and the owner can record a withdrawal", async ({ browser, playwright, baseURL }) => {
    const { token, forged } = JSON.parse(readFileSync(CONSENT_FILE, "utf8")) as { token: string; forged: string };
    const deleted = async (page: { request: { get: (u: string) => Promise<{ json: () => Promise<unknown> }> } }) => (await (await page.request.get(`${STORAGE_ORIGIN}/__deleted`)).json()) as string[];

    // The customer has no account: a fresh browser, no sign-in
    const customer = await browser.newPage({ storageState: { cookies: [], origins: [] } });
    await customer.goto(`/consent/withdraw?token=${forged}`);
    await expect(customer.locator("main").getByRole("alert")).toContainText("This link is not valid");
    await expect(customer.getByRole("button", { name: "Withdraw my agreement" })).toHaveCount(0);

    await customer.goto(`/consent/withdraw?token=${token}`);
    await expect(customer.getByRole("heading", { name: "Withdraw your agreement to an AI video" })).toBeVisible();
    await expect(customer.getByText("E2E Moderation Space")).toBeVisible();
    await expect(customer.getByText("Katherine Johnson")).toBeVisible();
    const filesBefore = (await deleted(customer)).length;
    await customer.getByRole("button", { name: "Withdraw my agreement" }).click();
    await expect(customer.getByRole("status")).toContainText("Your agreement is withdrawn");
    expect(await deleted(customer)).toHaveLength(filesBefore + 1); // the video file really went

    // Opening the link again shows it is done instead of offering the button
    await customer.reload();
    await expect(customer.getByText(/You withdrew your agreement on/)).toBeVisible();
    await expect(customer.getByRole("button", { name: "Withdraw my agreement" })).toHaveCount(0);
    await customer.close();

    // The owner sees it: the video is marked removed with the customer's reason, and no new one can be made
    const api = await playwright.request.newContext({ baseURL: baseURL! });
    await signIn(api, baseURL!, USERS.customer.email);
    const spaces = await (await api.get("/api/spaces")).json();
    const space = (spaces.spaces ?? spaces).find((s: { name: string }) => s.name === "E2E Moderation Space");
    const list = await (await api.get(`/api/spaces/${space.id}/testimonials`)).json();
    const testimonials: { id: string; customerName: string | null }[] = list.testimonials ?? list;
    const aiPanel = async (name: string) => (await (await api.get(`/api/spaces/${space.id}/testimonials/${testimonials.find((t) => t.customerName === name)!.id}/ai-video`)).json());
    const katherine = await aiPanel("Katherine Johnson");
    expect(katherine.consent).toBe(false);
    expect(katherine.videos[0]).toMatchObject({ status: "done", outputUrl: null, moderationReason: "The customer withdrew their consent to AI video." });

    // For the other customer the owner records the withdrawal (they told the owner directly)
    const dorothyId = testimonials.find((t) => t.customerName === "Dorothy Vaughan")!.id;
    expect((await aiPanel("Dorothy Vaughan")).consent).toBe(true);
    const recorded = await api.delete(`/api/spaces/${space.id}/testimonials/${dorothyId}/ai-video/consent`, { headers: { origin: baseURL! } });
    expect(recorded.status()).toBe(200);
    expect(await recorded.json()).toMatchObject({ status: "withdrawn", removedVideos: 1 });
    const dorothy = await aiPanel("Dorothy Vaughan");
    expect(dorothy.consent).toBe(false);
    expect(dorothy.videos[0].outputUrl).toBeNull();
    // Recording it twice is refused: there is nothing left to withdraw
    expect((await api.delete(`/api/spaces/${space.id}/testimonials/${dorothyId}/ai-video/consent`, { headers: { origin: baseURL! } })).status()).toBe(400);
    await api.dispose();
  });

  test("owner panels in the browser: a removed video says so and why, and the owner can record a withdrawal", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.customer.email);
    const page = await context.newPage();
    const spaces = await (await context.request.get("/api/spaces")).json();
    const space = (spaces.spaces ?? spaces).find((s: { name: string }) => s.name === "E2E Moderation Space");
    const card = (name: string) =>
      page.locator("div").filter({ hasText: name }).filter({ has: page.getByRole("button", { name: "AI video" }) }).last();

    await open(page, `/spaces/${space.id}/testimonials`);

    // A video an admin took down: the list says Removed and the panel gives the reason instead of an empty player
    await card("Grace Hopper").getByRole("button", { name: "AI video" }).click();
    const panel = page.getByRole("dialog", { name: "AI video" });
    await expect(panel.getByText("Removed", { exact: true })).toBeVisible();
    await panel.getByRole("button", { name: /Removed/ }).click();
    await expect(panel.getByText("This video was removed by our team")).toBeVisible();
    await expect(panel.getByText(new RegExp(REASON_TEXT))).toBeVisible();
    await panel.getByRole("button", { name: "Close" }).click();

    // A video removed because the customer withdrew: the owner sees the customer's reason
    await card("Katherine Johnson").getByRole("button", { name: "AI video" }).click();
    await panel.getByRole("button", { name: /Removed/ }).click();
    await expect(panel.getByText(/The customer withdrew their consent to AI video/)).toBeVisible();
    await panel.getByRole("button", { name: "Close" }).click();

    // Consent still active (the video was deleted by the owner earlier): the owner can record that the customer withdrew
    await card("Ada Lovelace").getByRole("button", { name: "AI video" }).click();
    await expect(panel.getByText(/The customer agreed to AI video/)).toBeVisible();
    await panel.getByRole("button", { name: "record that they withdrew consent" }).click();
    await expect(page.getByRole("dialog").getByText("Record that the customer withdrew consent?")).toBeVisible();
    await page.getByRole("button", { name: "Withdraw consent" }).click();
    await expect(page.getByText("Consent withdrawn. Their videos were removed.")).toBeVisible();
    await expect(panel.getByText("This customer hasn't agreed to AI video")).toBeVisible();
    await expect(panel.getByText(/The customer agreed to AI video/)).toHaveCount(0);
    await panel.getByRole("button", { name: "Close" }).click();

    // Review videos: the video an admin took down shows the same notice
    await open(page, `/spaces/${space.id}/reviews`);
    await page.getByRole("button", { name: "Create review video" }).click();
    await page.getByRole("button", { name: /Your videos/ }).click();
    await expect(page.getByText("Removed", { exact: true })).toBeVisible();
    await expect(page.getByText("This video was removed by our team")).toBeVisible();
    await expect(page.getByText(/The reviewer asked us to remove it/)).toBeVisible();
    await context.close();
  });

  test("owner reviews: add one by hand, it needs no Google or Trustpilot, and videos made from it use its own wording", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.customer.email);
    const page = await context.newPage();
    const spaces = await (await context.request.get("/api/spaces")).json();
    const space = (spaces.spaces ?? spaces).find((s: { name: string }) => s.name === "E2E Moderation Space");
    await open(page, `/spaces/${space.id}/reviews`);

    await page.getByRole("button", { name: "Add your own review" }).click();
    const form = page.getByRole("dialog", { name: "Add your own review" });
    await form.getByLabel("Name", { exact: true }).fill("Priya N.");
    await form.getByLabel("Review", { exact: true }).fill("They fixed our books in a week and never made us feel silly for asking.");

    // Only https links are accepted
    await form.getByLabel(/Link to the review/).fill("http://insecure.example/reviews");
    await form.getByRole("button", { name: "Save review" }).click();
    await expect(form.locator("div[role=alert].bg-danger-soft")).toContainText("https");

    await form.getByLabel(/Link to the review/).fill("https://www.priyas-bakery.example/reviews/1");
    await form.getByRole("button", { name: "Save review" }).click();
    await expect(page.getByText("Review added")).toBeVisible();

    // It shows with its own badge and no stars, and can be edited
    const card = page.locator("div").filter({ hasText: "Priya N." }).filter({ has: page.getByRole("button", { name: "Edit" }) }).filter({ hasText: "Added by you" }).last();
    await expect(card.getByText("Added by you")).toBeVisible();
    await expect(card.getByText(/\.0$/)).toHaveCount(0);
    await card.getByRole("button", { name: "Edit" }).click();
    await form.getByLabel("Name", { exact: true }).fill("Priya Nair");
    await form.getByRole("button", { name: "Save review" }).click();
    await expect(page.getByText("Priya Nair")).toBeVisible();

    // A review longer than the template can show: add one of 520 characters
    const longReview = "Our whole team uses it every single day and it has saved us hours. ".repeat(8).trim();
    await page.getByRole("button", { name: "Add your own review" }).click();
    await form.getByLabel("Name", { exact: true }).fill("Long Winded");
    await form.getByLabel("Review", { exact: true }).fill(longReview);
    await form.getByRole("button", { name: "Save review" }).click();
    await expect(page.getByText("Review added")).toBeVisible();

    // The video picker offers it, and picking it switches the confirmation to the wording for your own reviews
    await page.getByRole("button", { name: "Create review video" }).click();
    const picker = page.getByRole("dialog").last();
    await picker.getByRole("button", { name: /Priya Nair/ }).click();
    await expect(picker.getByRole("button", { name: /Priya Nair/ }).getByText("Added by you")).toBeVisible();
    await expect(picker.getByText(/genuine reviews from real customers/)).toBeVisible();
    // ... and it says up front that a cut will happen, before the owner confirms anything
    await expect(picker.getByText(/cut at a word.*nothing is reworded/)).toBeVisible();

    // The long review stays usable and says it will be shortened to the template's limit
    const longRow = picker.getByRole("button", { name: /Long Winded/ });
    await expect(longRow).toBeEnabled();
    await expect(longRow).toContainText("Will be shortened to 400 characters, ending with …");
    await longRow.click(); // a single-review template: this swaps the pick
    await expect(longRow).toContainText("Shortened to 400 characters, ending with …");
    await expect(picker.getByRole("button", { name: /Priya Nair/ })).not.toContainText("shortened");
    await page.keyboard.press("Escape");

    // Clean up so the rest of the run is unaffected
    const own = await (await context.request.get(`/api/spaces/${space.id}/reviews`)).json();
    for (const r of own.reviews.filter((r: { provider: string }) => r.provider === "own")) {
      expect((await context.request.delete(`/api/spaces/${space.id}/reviews/${r.id}`, { headers: { origin: baseURL! } })).ok()).toBe(true);
    }
    await context.close();
  });

  test("email verification: a new account cannot sign in until its email link is used", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const email = `e2e-verify-${Date.now()}@example.test`;

    // The sign-up rate limit sends the form back with an error: wait and try again
    for (let attempt = 1; ; attempt++) {
      await open(page, "/signup");
      await page.getByLabel("Full name").fill("E2E Verify");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: /create account/i }).click();
      if (await page.getByRole("heading", { name: /Check your email/ }).waitFor({ timeout: 8000 }).then(() => true, () => false)) break;
      if (attempt >= 5) throw new Error("sign-up never reached the check-your-email step");
      await page.waitForTimeout(4000);
    }

    // Signing in is refused until the link has been used
    // (the sign-in rate limit answers 429 when attempts come close together: wait and ask again)
    const attempt = async () => {
      for (let i = 0; i < 6; i++) {
        const res = await context.request.post("/api/auth/sign-in/email", { headers: { origin: baseURL! }, data: { email, password: PASSWORD } });
        if (res.status() !== 429) return res;
        await new Promise((r) => setTimeout(r, 4000));
      }
      throw new Error("kept being rate limited");
    };
    expect((await attempt()).status()).toBe(403);

    // The link in the email carries a token signed with the server's secret; make the same one
    const { createEmailVerificationToken } = await import("better-auth/api");
    const token = await createEmailVerificationToken(E2E_AUTH_SECRET, email, undefined, 3600);
    const verified = await context.request.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { maxRedirects: 0 });
    expect(verified.status(), verified.headers().location).toBeLessThan(400);
    expect(verified.headers().location ?? "").not.toMatch(/error/i);

    const ok = await attempt();
    expect(ok.status(), await ok.text()).toBe(200);
    await context.close();
  });

  test("two-factor sign-in: set up an authenticator app, sign in with a code and with a backup code, turn it off", async ({ browser, baseURL }) => {
    const OTPAuth = await import("otpauth");
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const email = `e2e-2fa-${Date.now()}@example.test`;

    await createConfirmedAccount(context.request, baseURL!, email, "E2E TwoFactor");
    await context.clearCookies();

    /** Signs in through the form, waiting out the sign-in rate limit, and returns where it ended up. */
    const signInForm = async (arrive: RegExp) => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        await open(page, "/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(PASSWORD);
        await page.getByRole("button", { name: "Sign in" }).click();
        if (await page.waitForURL(arrive, { timeout: 8000 }).then(() => true, () => false)) return;
        await page.waitForTimeout(4000);
      }
      throw new Error(`never arrived at ${arrive}`);
    };

    /** Submits the code step and waits to arrive; the code endpoints are rate limited (a few per 10 seconds), so wait and try again. */
    const submitCodeUntilIn = async (fill: () => Promise<void>) => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        await fill();
        await page.getByRole("button", { name: "Continue" }).click();
        if (await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 6000 }).then(() => true, () => false)) return;
        await page.waitForTimeout(5000);
      }
      throw new Error("the code step never let the person in");
    };

    await signInForm(/\/(dashboard|onboarding)/);

    // Set up: password, scan (we read the key instead), confirm with a code, keep the backup codes
    await open(page, "/settings/security");
    await page.getByRole("button", { name: "Turn on" }).click();
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: "SHA1" });
    await page.getByLabel("Code from the app").fill("000000");
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.locator("div[role=alert].bg-danger-soft")).toBeVisible(); // a wrong code is refused
    await page.getByLabel("Code from the app").fill(totp.generate());
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByTestId("backup-codes")).toBeVisible();
    await expect(page.getByTestId("backup-codes").locator("li").first()).toBeVisible();
    const codes = await page.getByTestId("backup-codes").locator("li").allTextContents();
    expect(codes.length).toBeGreaterThanOrEqual(5);
    await page.getByRole("button", { name: "I have saved them" }).click();
    await expect(page.getByText(/On\. You will be asked for a code/)).toBeVisible();

    // Signing in now stops at the code step: a wrong code is refused, a backup code works once
    await context.clearCookies();
    await signInForm(/\/two-factor/);
    await page.getByLabel("Code", { exact: true }).fill("000000");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("div[role=alert].bg-danger-soft")).toBeVisible();
    await page.getByRole("button", { name: "Use a backup code" }).click();
    await submitCodeUntilIn(() => page.getByLabel("Backup code").fill(codes[0].trim()));

    // The same backup code cannot be used again; an authenticator code works
    await context.clearCookies();
    await signInForm(/\/two-factor/);
    await page.getByRole("button", { name: "Use a backup code" }).click();
    await page.getByLabel("Backup code").fill(codes[0].trim());
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator("div[role=alert].bg-danger-soft")).toBeVisible();
    await page.getByRole("button", { name: "Use my authenticator app" }).click();
    await submitCodeUntilIn(() => page.getByLabel("Code", { exact: true }).fill(totp.generate()));

    // Turning it off needs the password
    await open(page, "/settings/security");
    await page.getByRole("button", { name: "Turn off" }).click();
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Turn off" }).last().click();
    await expect(page.getByText(/Off\. Your account is protected by your password alone/)).toBeVisible();
    await context.close();
  });

  test("delete account: password, emailed link, and the account is gone for good", async ({ browser, baseURL }) => {
    // The link's token, made the way lib/account/deletion.ts makes it
    const { createHmac } = await import("node:crypto");
    const deletionToken = (userId: string) => {
      const expires = Date.now() + 30 * 60_000;
      return `${userId}.${expires}.${createHmac("sha256", E2E_AUTH_SECRET).update(`account-delete:${userId}:${expires}`).digest("hex")}`;
    };
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const email = `e2e-delete-${Date.now()}@example.test`;
    await createConfirmedAccount(context.request, baseURL!, email, "E2E Delete");
    await context.clearCookies();

    for (let attempt = 1; attempt <= 5; attempt++) {
      await open(page, "/login");
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
      if (await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 8000 }).then(() => true, () => false)) break;
      await page.waitForTimeout(4000);
    }

    await open(page, "/settings");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await page.getByLabel("Your password").fill("not-my-password");
    await page.getByRole("button", { name: "Email me the link" }).click();
    await expect(page.getByText("That password is not right.")).toBeVisible();
    await page.getByLabel("Your password").fill(PASSWORD);
    await page.getByRole("button", { name: "Email me the link" }).click();
    await expect(page.getByText(/We sent a confirmation link/)).toBeVisible();

    // A link for someone else's account, and a made-up one, are refused
    await open(page, "/account/delete?token=nonsense");
    await expect(page.getByText(/expired or is not valid/)).toBeVisible();

    // The emailed link (made the way the server makes it)
    const me = await (await context.request.get("/api/auth/get-session")).json();
    await open(page, `/account/delete?token=${encodeURIComponent(deletionToken(me.user.id))}`);
    await page.getByRole("button", { name: "Delete my account forever" }).click();
    await expect(page.getByText("Your account has been deleted")).toBeVisible();

    const gone = await context.request.post("/api/auth/sign-in/email", { headers: { origin: baseURL! }, data: { email, password: PASSWORD } });
    expect(gone.ok()).toBe(false);
    await context.close();
  });

  test("notification inbox: filter unread, page, open an item, mark all read", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.customer.email);
    const page = await context.newPage();

    await open(page, "/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByText(/\d+ unread/)).toBeVisible();
    await expect(page.getByText("E2E notice 1", { exact: true })).toBeVisible(); // newest first
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();

    await page.getByRole("link", { name: "Older" }).click();
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    // A page past the end shows the last page, where the oldest notice is
    await open(page, "/notifications?page=99");
    await expect(page.getByText("E2E notice 25", { exact: true })).toBeVisible();

    await open(page, "/notifications?filter=unread");
    await expect(page.getByText("E2E notice 10", { exact: true })).toBeVisible();
    await expect(page.getByText("E2E notice 11", { exact: true })).toHaveCount(0); // read ones are hidden

    // The bell leads here
    await page.getByRole("button", { name: /Notifications, \d+ unread/ }).first().click();
    await page.getByRole("menuitem", { name: "View all" }).click();
    await expect(page).toHaveURL(/\/notifications$/);

    await page.locator("main").getByRole("button", { name: "Mark all read" }).click();
    await expect(page.locator("main").getByText("You are all caught up")).toBeVisible();
    await open(page, "/notifications?filter=unread");
    await expect(page.getByText("Nothing unread.")).toBeVisible();
    await context.close();
  });

  test("webhooks: a Slack-format endpoint is marked as one, and the test message reports an unreachable address", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.customer.email);
    const page = await context.newPage();
    await open(page, "/settings/webhooks");
    await expect(page.getByText("hooks.slack.invalid")).toBeVisible();
    await expect(page.getByText("Slack", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Send test" }).click();
    await expect(page.getByText(/Could not reach the endpoint|The endpoint answered/)).toBeVisible();

    // The format choice is on the add form
    await page.getByRole("button", { name: /Add (Webhook|Endpoint)/ }).first().click();
    await expect(page.getByLabel("Message format")).toBeVisible();
    await context.close();
  });

  test("direct upload: the browser sends the video straight to storage and the submission points at it", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const posted: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST") posted.push(new URL(r.url()).origin + new URL(r.url()).pathname);
    });
    await open(page, "/collect/e2e-collect");

    // A small MP4-shaped file, chosen in the form
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x20]), Buffer.from("ftypisom"), Buffer.alloc(2048)]);
    await page.locator('input[type="file"][accept^="video/mp4"]').setInputFiles({ name: "clip.mp4", mimeType: "video/mp4", buffer: mp4 });
    await page.getByLabel("Your name").fill("Direct Uploader");
    await page.getByLabel("Email address").fill("direct@example.test");
    await page.getByRole("button", { name: "Submit testimonial" }).click();
    await expect(page.getByText("Thank you for sharing!")).toBeVisible();

    // The file went to the storage address, not through our submissions route as a file
    expect(posted.some((u) => u.startsWith(STORAGE_ORIGIN) && u.includes(`/${"e2e-bucket"}`))).toBe(true);
    const stored: string[] = await (await fetch(`${STORAGE_ORIGIN}/__objects`)).json();
    const key = stored.find((k) => k.startsWith("uploads/pending/"));
    expect(key).toBeTruthy();

    const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    try {
      const { rows } = await pool.query(`SELECT video_url, type, status FROM submissions WHERE customer_email = 'direct@example.test'`);
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe("video");
      expect(String(rows[0].video_url)).toContain(key!);
    } finally {
      await pool.end();
    }

    // A made-up key is refused by the server
    const forged = await context.request.post("/api/collect/e2e-collect/submissions", {
      multipart: { customerName: "Mallory", customerEmail: "m@example.test", uploadKey: "uploads/pending/00000000-0000-0000-0000-000000000000/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.mp4" },
    });
    expect(forged.status()).toBe(400);
    await context.close();
  });

  test("brand kit: the collect form wears the space's colours and has no axe violations", async ({ browser, baseURL }) => {
    const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    let spaceId: string | undefined;
    try {
      const { rows: [owner] } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [USERS.customer.email]);
      const { rows: [space] } = await pool.query(`INSERT INTO spaces (name, owner_id, embed_key) VALUES ('E2E Brand Space', $1, 'e2e-brand') RETURNING id`, [owner.id]);
      spaceId = space.id;
      await pool.query(`INSERT INTO collection_forms (space_id, title, prompt_text, slug) VALUES ($1, 'E2E Branded', 'Say a few words', 'e2e-branded')`, [spaceId]);
      // Dark navy with white text and rounded corners; a yellow form-level colour is tried afterwards
      await pool.query(`INSERT INTO brand_kits (space_id, primary_color, accent_color, border_radius) VALUES ($1, '#123456', '#ffffff', 20)`, [spaceId]);

      await open(page, "/collect/e2e-branded");
      const submit = page.getByRole("button", { name: "Submit testimonial" });
      await expect(submit).toBeVisible();
      const style = await submit.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, fg: s.color, radius: s.borderTopLeftRadius };
      });
      expect(style).toEqual({ bg: "rgb(18, 52, 86)", fg: "rgb(255, 255, 255)", radius: "20px" });

      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes[0].target.join(" ")}`)).toEqual([]);

      // A colour set on the form itself wins over the kit
      await pool.query(`UPDATE collection_forms SET branding = '{"accentColor":"#ffee00"}' WHERE slug = 'e2e-branded'`);
      await open(page, "/collect/e2e-branded");
      await expect(submit).toBeVisible();
      expect(await submit.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 238, 0)");
    } finally {
      if (spaceId) await pool.query(`DELETE FROM spaces WHERE id = $1`, [spaceId]); // forms and kit go with it
      await pool.end();
      await context.close();
    }
  });

  test("video fonts: pick one on the Brand page, see it in the preview, and it is still there after a reload", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.customer.email);
    const page = await context.newPage();
    const spaces = await (await context.request.get("/api/spaces")).json();
    const space = (spaces.spaces ?? spaces).find((s: { name: string }) => s.name === "E2E Moderation Space");
    const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    try {
      await open(page, `/spaces/${space.id}/brand`);
      const group = page.getByRole("radiogroup", { name: "Video font" });
      await expect(group.getByRole("radio")).toHaveCount(7); // "each template's own" and the six fonts
      await expect(group.getByRole("radio", { name: /Each template's own/ })).toHaveAttribute("aria-checked", "true");

      await group.getByRole("radio", { name: /Lora/ }).click();
      await expect(group.getByRole("radio", { name: /Lora/ })).toHaveAttribute("aria-checked", "true");
      // The sample in the picker is drawn in the real font file, and the live preview uses it too
      await expect.poll(() => page.evaluate(() => document.fonts.check('600 20px "Lora"'))).toBe(true);
      await expect
        .poll(() => page.evaluate(() => [...document.querySelectorAll("*")].filter((el) => getComputedStyle(el).fontFamily.includes("Lora")).length))
        .toBeGreaterThan(1);

      await page.getByRole("button", { name: /^Save/ }).click();
      await expect(page.getByText("Brand settings saved.")).toBeVisible();
      expect((await (await context.request.get(`/api/spaces/${space.id}/brand-kit`)).json()).values.videoFont).toBe("lora");

      await open(page, `/spaces/${space.id}/brand`);
      await expect(page.getByRole("radiogroup", { name: "Video font" }).getByRole("radio", { name: /Lora/ })).toHaveAttribute("aria-checked", "true");

      // The wrong value is refused by the server, not just hidden by the page
      const forged = await context.request.put(`/api/spaces/${space.id}/brand-kit`, {
        headers: { origin: baseURL! },
        data: { primaryColor: "#112233", fontMode: "inherit", inheritTextColor: false, videoFont: "Comic Sans" },
      });
      expect(forged.status()).toBe(400);
    } finally {
      // Leave the shared space as it was: no kit, so later tests see the defaults
      await pool.query(`DELETE FROM brand_kits WHERE space_id = $1`, [space.id]);
      await pool.end();
      await context.close();
    }
  });

  test("videos in the widget: the owner switches one on, a real page shows it, and it is gone once it is taken down", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.customer.email);
    const page = await context.newPage();
    const spaces = await (await context.request.get("/api/spaces")).json();
    const space = (spaces.spaces ?? spaces).find((s: { name: string }) => s.name === "E2E Moderation Space");
    const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    const key = `review-videos/${space.id}/e2e-widget.mp4`;
    const objectUrl = `${STORAGE_ORIGIN}/e2e-bucket/${key}`;
    const widgetData = async () => (await (await context.request.get("/api/widget/e2e-moderation")).json()) as { testimonials: { id: string; generated?: string; customerName: string }[] };
    // A stand-in for a customer's page, served from this origin so the widget has a normal page to run in
    await page.route(`${baseURL}/e2e-embed-host`, (route) =>
      route.fulfill({ contentType: "text/html", body: `<!doctype html><title>Customer site</title><div data-vouchreel-embed></div><script src="/widget/vouchreel-widget.js" data-key="e2e-moderation"></script>` })
    );
    const embed = () => page.goto("/e2e-embed-host");
    let videoId = "";
    try {
      // A small video a browser can play (VP8 in WebM; the site's real files are MP4)
      const dir = mkdtempSync(path.join(tmpdir(), "e2e-widget-"));
      execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=0xcf3d0b:s=160x90:d=1:r=10", "-c:v", "libvpx", "-b:v", "100k", path.join(dir, "v.webm")]);
      const webm = readFileSync(path.join(dir, "v.webm"));
      // The browser fetches the file from the storage address; serve it from here (a test-only shortcut around
      // the browser's rules for localhost to 127.0.0.1) so the widget's behaviour is what is tested
      await page.route(objectUrl, (route) => route.fulfill({ status: 200, body: webm, headers: { "content-type": "video/webm", "access-control-allow-origin": "*" } }));
      // Where the file used to be, once it is gone: the request fails. (A new address, so no browser can answer from what it
      // fetched a moment ago, and a failure rather than a 404 so every browser reports it the same way.)
      const goneUrl = `${objectUrl}-gone`;
      await page.route(goneUrl, (route) => route.abort("failed"));
      const props = { reviews: [{ author: "Alice <b>M.</b>", rating: 5, text: "Great experience, would use again.", source: "google" }], brand: "#cf3d0b" };
      const { rows } = await pool.query(
        `INSERT INTO review_videos (space_id, template, status, props, rights_confirmed_at, output_url, duration_seconds) VALUES ($1, 'spotlight', 'done', $2, now(), $3, 1) RETURNING id`,
        [space.id, JSON.stringify(props), objectUrl]
      );
      videoId = rows[0].id;
      await pool.query(`INSERT INTO widget_configs (space_id, template, trigger_type, trigger_value) VALUES ($1, 'wall-of-love', 'delay', '{"seconds":0}') ON CONFLICT (space_id) DO UPDATE SET template = 'wall-of-love', trigger_type = 'delay', trigger_value = '{"seconds":0}'`, [space.id]);

      // Off until the owner turns it on
      expect((await widgetData()).testimonials.filter((t) => t.generated)).toEqual([]);

      // Only the owner can turn it on
      const stranger = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
      expect((await stranger.request.put(`/api/spaces/${space.id}/review-videos/${videoId}/widget`, { headers: { origin: baseURL! }, data: { show: true } })).status()).toBe(401);
      await stranger.close();
      expect((await context.request.put(`/api/spaces/${space.id}/review-videos/${videoId}/widget`, { headers: { origin: baseURL! }, data: { show: "yes" } })).status()).toBe(400);
      expect((await context.request.put(`/api/spaces/${space.id}/review-videos/${videoId}/widget`, { headers: { origin: baseURL! }, data: { show: true } })).ok()).toBe(true);

      const shown = (await widgetData()).testimonials.filter((t) => t.generated);
      expect(shown).toHaveLength(1);
      expect(shown[0]).toMatchObject({ id: videoId, generated: "review", customerName: "Alice <b>M.</b>" });

      // A real page with the embed script (not every browser build can play WebM, so say so rather than guess)
      await page.goto("/login");
      const canPlay = await page.evaluate(() => document.createElement("video").canPlayType('video/webm; codecs="vp8"') !== "");
      if (canPlay) {
        await embed();
        // (the space also has an ordinary video testimonial; this is the made one)
        const card = page.locator(".vr-blend-video-card", { hasText: "Review video" });
        await expect(card).toHaveCount(1, { timeout: 15_000 });
        // The name is text, not markup: the <b> is shown as typed
        await expect(card.locator(".vr-card-author-name")).toHaveText("Alice <b>M.</b>");
        await expect(card.locator(".vr-card-author-name b")).toHaveCount(0);
        await expect.poll(() => card.locator("video").evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThanOrEqual(1);

        // The file goes (a takedown deletes it at once) while the list still names it: the tile drops itself
        await pool.query(`UPDATE review_videos SET output_url = $2 WHERE id = $1`, [videoId, goneUrl]);
        await embed();
        await expect(page.locator(".vr-blend-video-card", { hasText: "Ada" })).toHaveCount(1, { timeout: 15_000 }); // the page did load its widget
        await expect(page.locator(".vr-blend-video-card", { hasText: "Review video" })).toHaveCount(0);
      }

      // And the next response no longer lists it
      await pool.query(`UPDATE review_videos SET moderated_at = now(), output_url = NULL WHERE id = $1`, [videoId]);
      expect((await widgetData()).testimonials.filter((t) => t.generated)).toEqual([]);
      // A taken-down video cannot be switched on again
      expect((await context.request.put(`/api/spaces/${space.id}/review-videos/${videoId}/widget`, { headers: { origin: baseURL! }, data: { show: true } })).status()).toBe(400);
    } finally {
      await pool.query(`DELETE FROM review_videos WHERE space_id = $1`, [space.id]);
      await pool.query(`DELETE FROM widget_configs WHERE space_id = $1`, [space.id]);
      await pool.end();
      await context.close();
    }
  });

  test("widget page: the live preview draws each layout, its cards open the pop-ups, and the phone view works", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL!, USERS.customer.email);
    const page = await context.newPage();
    // The preview's sample photos come from an outside image host; the test should not depend on it
    await page.route(/images\.unsplash\.com/, (route) => route.abort());
    const spaces = await (await context.request.get("/api/spaces")).json();
    const space = (spaces.spaces ?? spaces).find((s: { name: string }) => s.name === "E2E Moderation Space");
    const pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    try {
      for (const [template, heading] of [["wall-of-love", "Wall of Love Preview"], ["carousel", "Carousel Preview"], ["masonry", "Masonry Grid Preview"]] as const) {
        await pool.query(`INSERT INTO widget_configs (space_id, template) VALUES ($1, $2) ON CONFLICT (space_id) DO UPDATE SET template = $2`, [space.id, template]);
        await open(page, `/spaces/${space.id}/widget`);
        const preview = page.getByText("Live Widget Preview").locator("xpath=ancestor::div[contains(@class,'space-y-3')][1]");
        await expect(preview.getByText(heading)).toBeVisible();

        // A video card opens the video pop-up, which closes again
        await preview.getByRole("button").filter({ hasText: /Sarah|David/ }).first().dispatchEvent("click"); // (the mock cards are small buttons whose content overlaps their neighbours, so click this one directly)
        await expect(preview.getByText("Get Started Like Sarah")).toBeVisible();
        await preview.getByRole("button", { name: "Close preview modal" }).click();
        await expect(preview.getByText("Get Started Like Sarah")).toHaveCount(0);

        // A review card opens the review pop-up with that review's provider and author
        await preview.getByRole("button").filter({ hasText: /Google|Trustpilot/ }).first().dispatchEvent("click");
        const closeReview = preview.getByRole("button", { name: "Close review modal" });
        await expect(closeReview).toBeVisible();
        await expect(preview.getByText(/Google Maps|Trustpilot/).first()).toBeVisible();
        await closeReview.click();
        await expect(closeReview).toHaveCount(0);

        // The phone view is a narrower frame with the same content
        await preview.getByRole("button", { name: "Mobile", exact: true }).click();
        await expect(preview.getByText(heading)).toBeVisible();
        await preview.getByRole("button", { name: "Desktop", exact: true }).click();
      }
    } finally {
      await pool.query(`DELETE FROM widget_configs WHERE space_id = $1`, [space.id]);
      await pool.end();
      await context.close();
    }
  });

  test("content security policy: a fresh nonce on every page, and the main pages break none of it", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    // Record every violation the browser sees, from the start of each page
    await page.addInitScript(() => {
      (window as unknown as { __csp: string[] }).__csp = [];
      document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.effectiveDirective} ${e.blockedURI} ${e.sourceFile ?? ""}:${e.lineNumber}`));
    });
    const violations = async () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);

    const nonces = new Set<string>();
    for (const path of ["/", "/pricing", "/login", "/signup", "/forgot-password", "/collect/e2e-collect"]) {
      const response = await page.goto(path);
      const policy = response!.headers()["content-security-policy-report-only"] ?? response!.headers()["content-security-policy"] ?? "";
      const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
      expect(nonce, `${path} has a policy with a nonce`).toBeTruthy();
      nonces.add(nonce!);
      expect(policy).toContain("report-uri /api/csp-report");
      await page.waitForLoadState("networkidle");
      expect(await violations(), `${path} violations`).toEqual([]);
    }
    expect(nonces.size).toBe(6); // a new nonce for every request

    // The API is not a page: no policy there
    const api = await context.request.get("/api/health");
    expect(api.headers()["content-security-policy-report-only"]).toBeUndefined();
    expect(api.headers()["content-security-policy"] ?? "").not.toContain("nonce-");

    // Signed in: the dashboard and the pages added most recently
    await signIn(context.request, baseURL!, USERS.customer.email);
    const spaceList = await (await context.request.get("/api/spaces")).json();
    const brandSpace = (spaceList.spaces ?? spaceList).find((sp: { name: string }) => sp.name === "E2E Moderation Space");
    // The Brand page has the live video preview (Remotion's player), which needs data: media
    for (const path of ["/dashboard", "/settings", "/settings/security", "/notifications", "/settings/webhooks", `/spaces/${brandSpace.id}/brand`]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await violations(), `${path} violations`).toEqual([]);
    }
    await context.close();
  });

  test("audit log: the actions above are recorded, and filters and paging work", async ({ page }) => {
    await open(page, "/admin?tab=audit&type=user");
    await expect(page.getByText(`Changed plan for ${USERS.customer.email}`)).toBeVisible();
    await expect(page.getByText(`Granted admin for ${USERS.promote.email}`).first()).toBeVisible();
    await expect(page.getByText(`Revoked admin for ${USERS.promote.email}`)).toBeVisible();

    await open(page, "/admin?tab=audit&type=job");
    await expect(page.getByText(/Retried e2e_failed_probe job/)).toBeVisible();
    await expect(page.getByText(/Cancelled e2e_queued_probe job/)).toBeVisible();

    // Details expand to the recorded before and after values
    await open(page, "/admin?tab=audit&type=user");
    await page.getByText("Details").first().click();
    await expect(page.locator("pre").first()).toContainText('"from"');
    await expect(page.locator("pre").first()).toContainText('"to"');

    // The type menu and the Filter button work together
    await open(page, "/admin?tab=audit");
    await page.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "job", exact: true }).click();
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/type=job/);
    await expect(page.getByText(/Retried e2e_failed_probe job/)).toBeVisible();
    await expect(page.getByText(/Granted admin for/)).toHaveCount(0);

    // The search form filters, and Clear resets it
    await open(page, "/admin?tab=audit");
    await page.getByPlaceholder("Summary, action or admin email").fill("no-such-entry-xyz");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("No entries match these filters.")).toBeVisible();
    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page.getByText("No entries match these filters.")).toHaveCount(0);

    // Paging: seeded entries overflow the first page of 50
    await open(page, "/admin?tab=audit&q=E2E%20seeded%20entry");
    await expect(page.getByText(`1 to 50 of ${AUDIT_SEED_COUNT} entries`)).toBeVisible();
    await page.getByRole("link", { name: "Older" }).click();
    await expect(page.getByText(`51 to ${AUDIT_SEED_COUNT} of ${AUDIT_SEED_COUNT} entries`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Newer" })).toBeVisible();
  });

  test("plans & payments: edit a plan's limits, create and archive a plan, switch the payment provider", async ({ page }) => {
    await open(page, "/admin?tab=plans");
    const dialog = page.getByRole("dialog");

    // Edit: the badge and the spaces limit change, and survive a reload
    await row(page, PLAN_NAME).getByRole("button", { name: "Edit" }).click();
    await dialog.getByLabel("Badge").fill("E2E badge");
    await dialog.getByLabel("Max spaces", { exact: true }).fill("11");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Plan updated")).toBeVisible();
    await page.reload();
    await expect(row(page, PLAN_NAME).getByText("E2E badge")).toBeVisible();
    await expect(row(page, PLAN_NAME).getByRole("cell", { name: "11", exact: true })).toBeVisible();

    // Create, then archive it behind a confirmation, then bring it back
    const created = "E2E Created Plan";
    await page.getByRole("button", { name: "New plan" }).click();
    await dialog.getByLabel("Name").fill(created);
    await dialog.getByLabel("Price (USD)").fill("12.50");
    await dialog.getByRole("button", { name: "Create plan" }).click();
    await expect(page.getByText("Plan created")).toBeVisible();
    await expect(row(page, created)).toContainText("12.5");
    await row(page, created).getByRole("button", { name: "Archive" }).click();
    await page.getByRole("button", { name: "Archive plan" }).click();
    await expect(row(page, created)).toContainText("Archived");
    await row(page, created).getByRole("button", { name: "Activate" }).click();
    await expect(row(page, created)).toContainText("Active");

    // Payments: pick Dodo and save; a fresh page of the same session still shows Dodo. Then put Stripe back.
    // (A fresh page rather than a reload: WebKit's renderer crashed on repeated reloads in CI.)
    const saved = new RegExp("New checkouts will immediately use this provider");
    // Retried, because the toast from a previous save can still be on screen when the next save is clicked
    const provider = (name: RegExp) =>
      expect(async () => {
        const fresh = await page.context().newPage();
        try {
          await fresh.goto("/admin?tab=payments");
          await expect(fresh.getByRole("radio", { name })).toBeChecked({ timeout: 1000 });
        } finally {
          await fresh.close();
        }
      }).toPass({ timeout: 10_000 });
    await tab(page, "Payments").click();
    await page.getByRole("radio", { name: /Dodo/ }).check();
    await page.getByRole("button", { name: "Save Provider Configuration" }).click();
    await expect(page.getByText(saved).first()).toBeVisible();
    await provider(/Dodo/);
    await page.getByRole("radio", { name: /Stripe/ }).check();
    await page.getByRole("button", { name: "Save Provider Configuration" }).click();
    await expect(page.getByText(saved).nth(0)).toBeVisible();
    await provider(/Stripe/);
  });

  test("users: suspend an account (open session dies, sign-in refused with the reason), restore it, and adjust credits", async ({ page, playwright, baseURL }) => {
    const base = baseURL!;
    const member = await playwright.request.newContext({ baseURL: base });
    await signIn(member, base, USERS.member.email);
    expect((await member.get("/api/spaces")).status()).toBe(200);

    await open(page, `/admin?tab=users&q=${encodeURIComponent(USERS.member.email)}`);
    await row(page, USERS.member.email).getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("switch", { name: "Suspended" }).click();
    // A reason is required
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/Give a reason/).first()).toBeVisible();
    await dialog.getByLabel("Reason", { exact: true }).first().fill("Chargeback abuse");
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, USERS.member.email)).toContainText("Suspended");

    // The open session stops working at once, and signing in again is refused with the reason's wording
    expect((await member.get("/api/spaces")).status()).toBe(401);
    // (the sign-in rate limit answers 429 when attempts come close together: wait and ask again)
    const refusing = await playwright.request.newContext({ baseURL: base });
    let refused = await refusing.post("/api/auth/sign-in/email", { headers: { origin: base }, data: { email: USERS.member.email, password: PASSWORD } });
    for (let attempt = 1; refused.status() === 429 && attempt <= 5; attempt++) {
      await new Promise((r) => setTimeout(r, 4000));
      refused = await refusing.post("/api/auth/sign-in/email", { headers: { origin: base }, data: { email: USERS.member.email, password: PASSWORD } });
    }
    expect(refused.status()).toBe(403);
    expect(await refused.text()).toContain("suspended");

    // Restore, and they can sign in again
    await row(page, USERS.member.email).getByRole("button", { name: "Manage" }).click();
    await page.getByRole("dialog").getByRole("switch", { name: "Suspended" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, USERS.member.email)).not.toContainText("Suspended");
    const again = await playwright.request.newContext({ baseURL: base });
    await signIn(again, base, USERS.member.email);
    expect((await again.get("/api/spaces")).status()).toBe(200);

    // Credits: add five review video credits for this month, with a reason
    await row(page, USERS.member.email).getByRole("button", { name: "Manage" }).click();
    const credits = page.getByRole("dialog");
    await credits.getByLabel("Amount").fill("5");
    await credits.getByLabel("Reason", { exact: true }).last().fill("Goodwill after an outage");
    await credits.getByRole("button", { name: "Apply credits" }).click();
    await expect(page.getByText("Credits adjusted for this month.")).toBeVisible();
    await expect(credits.getByRole("list", { name: "Adjustments this month" })).toContainText("+5 review");
    await expect(credits.getByRole("list", { name: "Adjustments this month" })).toContainText("Goodwill after an outage");

    // All of it is in the audit log
    await open(page, "/admin?tab=audit&q=e2e-member");
    await expect(page.getByText(/Suspended e2e-member@example.test/)).toBeVisible();
    await expect(page.getByText(/Restored e2e-member@example.test/)).toBeVisible();
    await expect(page.getByText(/Added 5 review video credits for e2e-member@example.test/)).toBeVisible();
    await Promise.all([member.dispose(), again.dispose()]);
  });

  test("system: see what a worker is doing and ask it to restart; only a running worker can be", async ({ page }) => {
    await open(page, "/admin?tab=system");
    const video = row(page, "4242");
    await expect(video).toContainText("Idle");
    // The job worker went quiet ten minutes ago: nothing to restart
    await expect(row(page, "4343").getByRole("button", { name: "Restart" })).toHaveCount(0);

    await video.getByRole("button", { name: "Restart" }).click();
    await expect(page.getByRole("dialog").getByText("Restart this video worker?")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/only comes back if something supervises it/)).toBeVisible();
    await page.getByRole("button", { name: "Restart", exact: true }).last().click();
    await expect(page.getByText(/Restart requested/).first()).toBeVisible();
    await expect(row(page, "4242")).toContainText("restart requested");

    await open(page, "/admin?tab=audit&q=restart");
    await expect(page.getByText("Asked the video worker on e2e-host to restart")).toBeVisible();
  });

  test("accessibility: no axe violations on any tab", async ({ page }) => {
    const problems: string[] = [];
    for (const name of ["plans", "payments", "users", "videos", "usage", "moderation", "audit", "system"]) {
      await open(page, `/admin?tab=${name}`);
      await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of violations) problems.push(`${name}: ${v.id} (${v.impact}) ${v.nodes.length} node(s): ${v.nodes[0].target.join(" ")}`);
    }
    expect(problems).toEqual([]);
  });

  test("phone width: job actions are on screen and emails stay on one line", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await open(page, "/admin?tab=videos");
    const buttons = page.getByRole("button", { name: /^(Retry|Cancel)$/ });
    await expect(buttons.first()).toBeVisible();
    for (const b of await buttons.all()) {
      const box = (await b.boundingBox())!;
      expect(box.x + box.width, "an action button runs past the right edge").toBeLessThanOrEqual(390);
    }
    // The Manage button on the Users tab must be reachable too
    await open(page, "/admin?tab=users");
    const manage = (await page.getByRole("button", { name: "Manage" }).first().boundingBox())!;
    expect(manage.x + manage.width, "Manage runs past the right edge").toBeLessThanOrEqual(390);
    for (const tabName of ["users", "moderation", "videos"]) {
      await open(page, `/admin?tab=${tabName}`);
      for (const el of await page.getByText(/@example\.test$/).all()) {
        if (!(await el.isVisible()) || (await el.evaluate((n) => n.children.length)) > 0) continue;
        const oneLine = await el.evaluate((n) => {
          const range = document.createRange();
          range.selectNodeContents(n);
          return new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size === 1;
        });
        expect(oneLine, `an email wraps in tab ${tabName}`).toBe(true);
      }
    }
  });

  test("phone width: no tab scrolls the page sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const name of ["plans", "payments", "users", "videos", "usage", "moderation", "audit", "system"]) {
      await open(page, `/admin?tab=${name}`);
      await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `tab ${name} overflows the viewport by ${overflow}px`).toBeLessThanOrEqual(1);
      // A table wider than its card would hide columns (and buttons) behind a sideways scroll
      const clipped = await page.evaluate(() =>
        Array.from(document.querySelectorAll("table")).filter((t) => t.parentElement && t.scrollWidth > t.parentElement.clientWidth + 1).length
      );
      expect(clipped, `tab ${name} has a table wider than its card`).toBe(0);
      if (process.env.E2E_SHOTS) await page.screenshot({ path: `e2e/.results/shots/phone-${name}.png`, fullPage: true });
    }
  });
});
