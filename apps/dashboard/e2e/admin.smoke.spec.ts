import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, AUDIT_SEED_COUNT, FAILED_JOB_ERROR, FAILED_JOB_TYPE, PASSWORD, PLAN_NAME, QUEUED_JOB_TYPE, REASON_TEXT, STORAGE_ORIGIN, USERS } from "./seed";

/** Smoke tests for the platform-admin area (/admin). Tests run in order and share seeded rows. */
test.describe.configure({ mode: "serial" });

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
    expect((await deleted())[1]).toMatch(/^review-videos\/.+\.mp4$/);

    // The healthy video is untouched, and the action is in the audit log
    await page.goto("/admin?tab=moderation&filter=live&q=E2E%20Moderation");
    await expect(row(page, "E2E healthy narration script.")).toContainText("Live");
    await page.goto("/admin?tab=audit&type=video");
    await expect(page.getByText(/Took down AI video \(bold\)/)).toBeVisible();
    await expect(page.getByText(/Took down review video \(spotlight\)/)).toBeVisible();
  });

  test("moderation: the owner sees that a video was removed, and why", async ({ playwright, baseURL }) => {
    const base = baseURL!;
    const api = await playwright.request.newContext({ baseURL: base });
    const signIn = await api.post("/api/auth/sign-in/email", { headers: { origin: base }, data: { email: USERS.customer.email, password: PASSWORD } });
    expect(signIn.ok()).toBe(true);

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
    await api.dispose();
  });

  test("audit log: the actions above are recorded, and filters and paging work", async ({ page }) => {
    await page.goto("/admin?tab=audit&type=user");
    await expect(page.getByText(`Changed plan for ${USERS.customer.email}`)).toBeVisible();
    await expect(page.getByText(`Granted admin for ${USERS.promote.email}`)).toBeVisible();

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

  test("phone width: no tab scrolls the page sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const name of ["plans", "payments", "users", "videos", "usage", "moderation", "audit", "system"]) {
      await page.goto(`/admin?tab=${name}`);
      await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `tab ${name} overflows the viewport by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
