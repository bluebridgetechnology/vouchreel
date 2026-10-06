import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import pg from "pg";
import AxeBuilder from "@axe-core/playwright";
import { ADMIN_STATE, CONSENT_FILE, AUDIT_SEED_COUNT, FAILED_JOB_ERROR, FAILED_JOB_TYPE, PASSWORD, PLAN_NAME, QUEUED_JOB_TYPE, REASON_TEXT, STORAGE_ORIGIN, USERS } from "./seed";

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

const TABS = ["Plans & pricing", "Payments", "Users", "Video & jobs", "Usage", "Moderation", "Audit log", "System"] as const;

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Admin sections" }).getByRole("link", { name });
const row = (page: Page, text: string | RegExp) => page.getByRole("row").filter({ hasText: text });

test.describe("access control", () => {
  test("an anonymous visitor is sent to the login page", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a signed-in customer cannot open the admin area", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(USERS.member.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    // A brand-new account lands on onboarding, an established one on the dashboard
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
    await expect(page.getByRole("heading", { name: "Admin", exact: true })).toHaveCount(0);
  });
});

test.describe("platform admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("every tab opens", async ({ page }) => {
    await page.goto("/admin");
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
    await page.goto("/admin?tab=system");
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
    await page.goto("/admin?tab=videos");
    await expect(page.getByText("Failed jobs")).toBeVisible();
    // Jobs are waiting and no job worker is alive: the page says so at the top
    await expect(page.getByRole("alert").filter({ hasText: "No job worker is running" })).toBeVisible();
    await expect(page.getByRole("alert").filter({ hasText: "video worker" })).toHaveCount(0);

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
    await page.goto(`/admin?tab=users&q=${encodeURIComponent("e2e-")}`);

    // Grant a plan by hand
    await row(page, USERS.customer.email).getByRole("button", { name: "Manage" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(USERS.customer.email)).toBeVisible();
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: new RegExp(PLAN_NAME) }).click();
    await dialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(`Updated ${USERS.customer.email}.`)).toBeVisible();
    await expect(row(page, USERS.customer.email)).toContainText(PLAN_NAME);
    await expect(row(page, USERS.customer.email)).toContainText("Granted");

    // Promote another user to platform admin
    await row(page, USERS.promote.email).getByRole("button", { name: "Manage" }).click();
    await page.getByRole("switch").click();
    await page.getByRole("dialog").getByRole("button", { name: "Save changes" }).click();
    await expect(row(page, USERS.promote.email)).toContainText("Admin");

    // A plan billed by a payment provider cannot be changed here
    await row(page, USERS.billed.email).getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("dialog").getByText(/Change or cancel it there/)).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("combobox")).toBeDisabled();
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

    // You cannot change your own admin access
    await row(page, USERS.admin.email).getByRole("button", { name: "Manage" }).click();
    await expect(page.getByRole("switch")).toBeDisabled();
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
    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/);

    // Giving it back works at once too
    expect((await request.patch(`/api/admin/users/${target.id}`, { headers: { origin: baseURL! }, data: { isPlatformAdmin: true } })).status()).toBe(200);
    expect((await context.request.get("/api/admin/jobs")).status()).toBe(200);
    await context.close();
  });

  test("phone width: the Take down button is on screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/admin?tab=moderation");
    const takeDown = page.getByRole("button", { name: "Take down" }).first();
    await expect(takeDown).toBeVisible();
    const tdBox = (await takeDown.boundingBox())!;
    expect(tdBox.x + tdBox.width, "Take down runs past the right edge").toBeLessThanOrEqual(390);
  });

  test("moderation: find a video whose consent was withdrawn and take it down, with a retry after storage fails", async ({ page, playwright }) => {
    const deleted = async () => (await (await page.request.get(`${STORAGE_ORIGIN}/__deleted`)).json()) as string[];
    await page.goto("/admin?tab=moderation&q=E2E%20Moderation");

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
    await page.goto("/admin?tab=moderation&filter=removed&q=E2E%20Moderation");
    const gone = row(page, "E2E withdrawn narration script.");
    await expect(gone).toContainText("Taken down");
    await expect(gone).toContainText(REASON_TEXT);
    await expect(gone).toContainText(USERS.admin.email);
    await expect(gone.getByRole("button", { name: "Take down" })).toHaveCount(0);
    await expect(gone.getByRole("link", { name: "Open file" })).toHaveCount(0);

    // A review video goes the same way
    await page.goto("/admin?tab=moderation&kind=review&q=E2E%20Moderation");
    await row(page, "E2E review video text.").getByRole("button", { name: "Take down" }).click();
    await page.getByRole("dialog").getByLabel("Reason").fill("The reviewer asked us to remove it");
    await page.getByRole("dialog").getByRole("button", { name: "Take down" }).click();
    await expect(page.getByText("Video taken down. Its owner has been told.")).toBeVisible();
    // Wait for the page's own refresh to land before navigating away (WebKit interrupts a goto otherwise)
    await expect(row(page, "E2E review video text.")).toContainText("Taken down");
    expect((await deleted())[1]).toMatch(/^review-videos\/.+\.mp4$/);

    // The healthy video is untouched, and the action is in the audit log
    await page.goto("/admin?tab=moderation&filter=live&q=E2E%20Moderation");
    await expect(row(page, "E2E healthy narration script.")).toContainText("Live");
    await page.goto("/admin?tab=audit&type=video");
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

    await page.goto(`/spaces/${space.id}/testimonials`);

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
    await page.goto(`/spaces/${space.id}/reviews`);
    await page.getByRole("button", { name: "Create review video" }).click();
    await page.getByRole("button", { name: /Your videos/ }).click();
    await expect(page.getByText("Removed", { exact: true })).toBeVisible();
    await expect(page.getByText("This video was removed by our team")).toBeVisible();
    await expect(page.getByText(/The reviewer asked us to remove it/)).toBeVisible();
    await context.close();
  });

  test("audit log: the actions above are recorded, and filters and paging work", async ({ page }) => {
    await page.goto("/admin?tab=audit&type=user");
    await expect(page.getByText(`Changed plan for ${USERS.customer.email}`)).toBeVisible();
    await expect(page.getByText(`Granted admin for ${USERS.promote.email}`).first()).toBeVisible();
    await expect(page.getByText(`Revoked admin for ${USERS.promote.email}`)).toBeVisible();

    await page.goto("/admin?tab=audit&type=job");
    await expect(page.getByText(/Retried e2e_failed_probe job/)).toBeVisible();
    await expect(page.getByText(/Cancelled e2e_queued_probe job/)).toBeVisible();

    // Details expand to the recorded before and after values
    await page.goto("/admin?tab=audit&type=user");
    await page.getByText("Details").first().click();
    await expect(page.locator("pre").first()).toContainText('"from"');
    await expect(page.locator("pre").first()).toContainText('"to"');

    // The type menu and the Filter button work together
    await page.goto("/admin?tab=audit");
    await page.getByRole("combobox", { name: "Type" }).click();
    await page.getByRole("option", { name: "job", exact: true }).click();
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page).toHaveURL(/type=job/);
    await expect(page.getByText(/Retried e2e_failed_probe job/)).toBeVisible();
    await expect(page.getByText(/Granted admin for/)).toHaveCount(0);

    // The search form filters, and Clear resets it
    await page.goto("/admin?tab=audit");
    await page.getByPlaceholder("Summary, action or admin email").fill("no-such-entry-xyz");
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText("No entries match these filters.")).toBeVisible();
    await page.getByRole("link", { name: "Clear" }).click();
    await expect(page.getByText("No entries match these filters.")).toHaveCount(0);

    // Paging: seeded entries overflow the first page of 50
    await page.goto("/admin?tab=audit&q=E2E%20seeded%20entry");
    await expect(page.getByText(`1 to 50 of ${AUDIT_SEED_COUNT} entries`)).toBeVisible();
    await page.getByRole("link", { name: "Older" }).click();
    await expect(page.getByText(`51 to ${AUDIT_SEED_COUNT} of ${AUDIT_SEED_COUNT} entries`)).toBeVisible();
    await expect(page.getByRole("link", { name: "Newer" })).toBeVisible();
  });

  test("plans & payments: edit a plan's limits, create and archive a plan, switch the payment provider", async ({ page }) => {
    await page.goto("/admin?tab=plans");
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

  test("accessibility: no axe violations on any tab", async ({ page }) => {
    const problems: string[] = [];
    for (const name of ["plans", "payments", "users", "videos", "usage", "moderation", "audit", "system"]) {
      await page.goto(`/admin?tab=${name}`);
      await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      for (const v of violations) problems.push(`${name}: ${v.id} (${v.impact}) ${v.nodes.length} node(s): ${v.nodes[0].target.join(" ")}`);
    }
    expect(problems).toEqual([]);
  });

  test("phone width: job actions are on screen and emails stay on one line", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/admin?tab=videos");
    const buttons = page.getByRole("button", { name: /^(Retry|Cancel)$/ });
    await expect(buttons.first()).toBeVisible();
    for (const b of await buttons.all()) {
      const box = (await b.boundingBox())!;
      expect(box.x + box.width, "an action button runs past the right edge").toBeLessThanOrEqual(390);
    }
    // The Manage button on the Users tab must be reachable too
    await page.goto("/admin?tab=users");
    const manage = (await page.getByRole("button", { name: "Manage" }).first().boundingBox())!;
    expect(manage.x + manage.width, "Manage runs past the right edge").toBeLessThanOrEqual(390);
    for (const tabName of ["users", "moderation", "videos"]) {
      await page.goto(`/admin?tab=${tabName}`);
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
      await page.goto(`/admin?tab=${name}`);
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
