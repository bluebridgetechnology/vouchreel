import { expect, test, type Page } from "@playwright/test";
import { ADMIN_STATE, AUDIT_SEED_COUNT, FAILED_JOB_ERROR, FAILED_JOB_TYPE, PASSWORD, PLAN_NAME, QUEUED_JOB_TYPE, USERS } from "./seed";

/** Smoke tests for the platform-admin area (/admin). Tests run in order and share seeded rows. */
test.describe.configure({ mode: "serial" });

const TABS = ["Plans & pricing", "Payments", "Users", "Video & jobs", "Usage", "Audit log", "System"] as const;

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
    for (const name of ["plans", "payments", "users", "videos", "usage", "audit", "system"]) {
      await page.goto(`/admin?tab=${name}`);
      await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `tab ${name} overflows the viewport by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });
});
