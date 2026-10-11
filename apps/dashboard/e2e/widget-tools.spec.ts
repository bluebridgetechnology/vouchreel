import { expect, test, type Page } from "@playwright/test";
import pg from "pg";
import AxeBuilder from "@axe-core/playwright";
import { PASSWORD, USERS } from "./seed";

/**
 * The widget editor's newer tools in a real browser: the performance strip, the install check, a widget's own
 * page, version history, copy style and style experiments. They share one space of their own, set up here, and
 * run after the admin suite (files run in name order), so nothing in that suite sees these rows.
 */
test.describe.configure({ mode: "serial" });

const SPACE_NAME = "E2E Tools Space";
const EMBED_KEY = "e2e-tools";

async function signIn(context: { post: (url: string, options: { headers: Record<string, string>; data: unknown }) => Promise<{ ok(): boolean; status(): number }> }, base: string, email: string) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const res = await context.post("/api/auth/sign-in/email", { headers: { origin: base }, data: { email, password: PASSWORD } });
    if (res.ok()) return;
    if (res.status() !== 429) throw new Error(`Sign-in as ${email} failed with ${res.status()}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`Sign-in as ${email} kept being rate limited`);
}

/** Goes to a page, trying again when the app's own redirect interrupts the navigation. */
async function open(page: Page, url: string) {
  for (let attempt = 1; ; attempt++) {
    try {
      await page.goto(url);
      return;
    } catch (error) {
      if (attempt >= 3 || !/interrupted by another navigation|NS_BINDING_ABORTED|frame was detached/i.test(String(error))) throw error;
      await page.waitForLoadState("load").catch(() => {});
    }
  }
}

/** Opens a section of the widget editor by its title, unless it is open already. */
async function openSection(page: Page, title: string) {
  const header = page.getByRole("button", { name: new RegExp(`^\\d\\s*${title}`) });
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
}

test.describe("widget tools", () => {
  let pool: pg.Pool;
  let spaceId = "";
  let wallId = "";
  let cornerId = "";

  test.beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.E2E_DATABASE_URL });
    const { rows: [owner] } = await pool.query(`SELECT id FROM "user" WHERE email = $1`, [USERS.customer.email]);
    await pool.query(`DELETE FROM spaces WHERE embed_key = $1`, [EMBED_KEY]);
    const { rows: [space] } = await pool.query(`INSERT INTO spaces (name, owner_id, embed_key) VALUES ($1, $2, $3) RETURNING id`, [SPACE_NAME, owner.id, EMBED_KEY]);
    spaceId = space.id;
    // A wall that has been live for a couple of days, with its own look
    const { rows: [wall] } = await pool.query(
      `INSERT INTO widget_configs (space_id, name, template, sort_order, is_live, published_at, theme)
       VALUES ($1, 'Wall', 'wall-of-love', 0, true, now() - interval '2 days', $2) RETURNING id`,
      [spaceId, JSON.stringify({ primaryColor: "#112233", accentColor: "#ffffff", mode: "dark", borderRadius: 30 })]
    );
    wallId = wall.id;
    const { rows: [corner] } = await pool.query(`INSERT INTO widget_configs (space_id, name, template, sort_order) VALUES ($1, 'Corner', 'floating-card', 1) RETURNING id`, [spaceId]);
    cornerId = corner.id;
    await pool.query(
      `INSERT INTO testimonials (space_id, platform, quote, customer_name, customer_company, is_active)
       VALUES ($1, 'youtube', 'Setup took ten minutes and our demo requests doubled.', 'Pat Lee', 'Northwind', true)`,
      [spaceId]
    );
    // Eight views over three days, two plays and a click, all from one site
    for (const [daysAgo, views, plays, clicks] of [[0, 3, 1, 1], [1, 3, 1, 0], [2, 2, 0, 0]] as const) {
      for (const [type, n] of [["impression", views], ["play", plays], ["click", clicks]] as const) {
        for (let i = 0; i < n; i++) {
          await pool.query(
            `INSERT INTO events (space_id, widget_id, event_type, session_id, page_url, timestamp) VALUES ($1, $2, $3, $4, 'https://shop.example.test/pricing?plan=pro', now() - make_interval(days => $5, mins => $6))`,
            [spaceId, wallId, type, `e2e-tools-${daysAgo}-${i}`, daysAgo, i + 1]
          );
        }
      }
    }
  });

  test.afterAll(async () => {
    await pool.query(`DELETE FROM spaces WHERE embed_key = $1`, [EMBED_KEY]); // widgets, events, experiments and versions go with it
    await pool.end();
  });

  async function owner(browser: import("@playwright/test").Browser, baseURL: string) {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    await signIn(context.request, baseURL, USERS.customer.email);
    return { context, page: await context.newPage() };
  }

  test("performance strip: a closed summary in words, and the numbers, a bar a day and no axe violations when opened", async ({ browser, baseURL }) => {
    const { context, page } = await owner(browser, baseURL!);
    try {
      await open(page, `/spaces/${spaceId}/widget/${wallId}`);
      const strip = page.locator("details", { hasText: "How it is doing" });
      await expect(strip).toContainText("8 views, 25% played in 30 days");
      await expect(strip).not.toHaveAttribute("open", "");

      await strip.locator("summary").click();
      await expect(strip.getByText("Views", { exact: true })).toBeVisible();
      await expect(strip.getByText("Clicks", { exact: true })).toBeVisible();
      const chart = strip.getByRole("img", { name: /Views and plays each day for the last 30 days. 8 views, 2 plays in total/ });
      await expect(chart).toBeVisible();
      await expect(chart.locator("title")).toHaveCount(30);
      // The widget was published two days ago, which is inside the window, so the chart says where
      await expect(strip).toContainText("The line marks when you last published");

      const results = await new AxeBuilder({ page }).include("details").analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

      // A widget nobody has seen says so instead of drawing an empty chart
      await open(page, `/spaces/${spaceId}/widget/${cornerId}`);
      await page.locator("details", { hasText: "How it is doing" }).locator("summary").click();
      await expect(page.getByText(/Nobody has seen this widget yet|Numbers appear here once/)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("install check: last seen comes from real visits, and a page that cannot be checked says why in plain words", async ({ browser, baseURL }) => {
    const { context, page } = await owner(browser, baseURL!);
    try {
      await open(page, `/spaces/${spaceId}/widget/${wallId}`);
      await openSection(page, "Install");
      await expect(page.getByRole("heading", { name: "Is it on your site?" })).toBeVisible();
      const panel = page;
      await expect(panel.getByText(/This widget was last seen on shop\.example\.test, /)).toBeVisible();
      // The site it was seen on is offered for the check: its front page, never a page address with its query (which can hold personal details)
      const input = panel.getByLabel("Check a page");
      await expect(input).toHaveValue("https://shop.example.test/");

      // An address on a private network is refused, and the owner is told so
      await input.fill("127.0.0.1");
      await panel.getByRole("button", { name: "Check", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Internal or private addresses are not allowed." })).toBeVisible();

      // Something that is not an address at all
      await input.fill("two words");
      await panel.getByRole("button", { name: "Check", exact: true }).click();
      await expect(page.getByRole("alert").filter({ hasText: /address|page/i }).first()).toBeVisible();

      // A widget that has never been seen says that, not "not found"
      await open(page, `/spaces/${spaceId}/widget/${cornerId}`);
      await openSection(page, "Install");
      await expect(page.getByText(/has not been seen on any site in the last 30 days/).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("a page of its own: turn it on, share the link, anyone can open it, turn it off and it is gone", async ({ browser, baseURL }) => {
    const { context, page } = await owner(browser, baseURL!);
    const visitor = await browser.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    try {
      // A widget that floats in a corner cannot have one: the switch is not offered
      await open(page, `/spaces/${spaceId}/widget/${cornerId}`);
      await openSection(page, "Install");
      await expect(page.getByRole("switch", { name: "Give it a page of its own" })).toHaveCount(0);

      await open(page, `/spaces/${spaceId}/widget/${wallId}`);
      await openSection(page, "Install");
      const toggle = page.getByRole("switch", { name: "Give it a page of its own" });
      await expect(toggle).toHaveAttribute("aria-checked", "false");
      // (The page answers with its "not found" content rather than a 404 status, because the app starts streaming before the page can decide; the data behind it is a real 404)
      const closed = await visitor.newPage();
      await closed.goto(`/wall/${wallId}`);
      await expect(closed.getByRole("heading", { name: "Page not found" })).toBeVisible();
      await expect(closed.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      expect((await visitor.request.get(`/api/widget/wall-${wallId}`)).status()).toBe(404);
      await closed.close();

      await toggle.click();
      await expect(page.getByText(`/wall/${wallId}`)).toBeVisible();
      await expect.poll(async () => (await pool.query(`SELECT wall_enabled FROM widget_configs WHERE id = $1`, [wallId])).rows[0].wall_enabled).toBe(true);

      // A visitor with no account sees the real widget on a page of its own, though the page rules and the live switch do not apply
      await pool.query(`UPDATE widget_configs SET is_live = false, pages_included = '{/pricing}' WHERE id = $1`, [wallId]);
      const wall = await visitor.newPage();
      await wall.goto(`/wall/${wallId}`);
      await expect(wall.getByRole("heading", { name: `What customers say about ${SPACE_NAME}` })).toBeVisible();
      await expect(wall.getByText("Setup took ten minutes and our demo requests doubled.")).toBeVisible({ timeout: 20_000 });
      const results = await new AxeBuilder({ page: wall }).analyze();
      expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious").map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target} ${n.any[0]?.message}`).join(" | ")}`)).toEqual([]);

      await toggle.click();
      await expect.poll(async () => (await visitor.request.get(`/api/widget/wall-${wallId}`)).status()).toBe(404);
      await wall.reload();
      await expect(wall.getByRole("heading", { name: "Page not found" })).toBeVisible();
    } finally {
      await pool.query(`UPDATE widget_configs SET is_live = true, pages_included = '{}', wall_enabled = false WHERE id = $1`, [wallId]);
      await visitor.close();
      await context.close();
    }
  });

  test("version history: publishing keeps the version it replaces, and restoring loads it as unpublished changes", async ({ browser, baseURL }) => {
    const { context, page } = await owner(browser, baseURL!);
    try {
      await open(page, `/spaces/${spaceId}/widget/${wallId}`);
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "History" }).click();
      await expect(page.getByRole("dialog").getByText(/No history yet/)).toBeVisible();
      await page.keyboard.press("Escape");

      // Change the layout and publish
      await page.getByRole("radio", { name: /^Carousel/ }).click();
      await expect(page.getByRole("status").filter({ hasText: "Unpublished changes" })).toBeVisible();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Published" })).toBeVisible();

      await page.getByRole("button", { name: "History" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByText("Live now")).toBeVisible();
      await expect(dialog.getByText("Before history", { exact: true })).toBeVisible();
      await expect(dialog.getByText(/Published\. Changed: layout/)).toBeVisible();

      // Restore how it was before: it loads into the editor, and the site is unchanged until publish
      await dialog.getByRole("button", { name: "Restore" }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("radio", { name: /^Wall of love/ })).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("status").filter({ hasText: "Unpublished changes" })).toBeVisible();
      expect((await pool.query(`SELECT template FROM widget_configs WHERE id = $1`, [wallId])).rows[0].template).toBe("carousel");

      // Undo goes back to the carousel
      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByRole("radio", { name: /^Carousel/ })).toHaveAttribute("aria-checked", "true");

      // Publishing the restored version puts it live, and that is kept too
      await page.getByRole("button", { name: "History" }).click();
      await page.getByRole("dialog").getByRole("button", { name: "Restore" }).click();
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await expect.poll(async () => (await pool.query(`SELECT template FROM widget_configs WHERE id = $1`, [wallId])).rows[0].template).toBe("wall-of-love");
      expect((await pool.query(`SELECT count(*)::int AS n FROM widget_versions WHERE widget_id = $1`, [wallId])).rows[0].n).toBe(3);
    } finally {
      await context.close();
    }
  });

  test("copy style: pick widgets, the look goes into their drafts, and nothing goes live", async ({ browser, baseURL }) => {
    const { context, page } = await owner(browser, baseURL!);
    try {
      await open(page, `/spaces/${spaceId}/widget`);
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: "More actions for Wall" }).click();
      await page.getByRole("menuitem", { name: /Copy style to/ }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Copy style from Wall" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "Copy style" })).toBeDisabled();

      // Only this space's other widgets are offered here, and not the one being copied from
      await expect(dialog.getByText("Corner", { exact: true })).toBeVisible();
      await expect(dialog.getByRole("checkbox")).toHaveCount((await pool.query(`SELECT count(*)::int AS n FROM widget_configs w JOIN spaces s ON s.id = w.space_id JOIN "user" u ON u.id = s.owner_id WHERE u.email = $1 AND w.id <> $2`, [USERS.customer.email, wallId])).rows[0].n);

      await dialog.getByRole("checkbox", { name: /Corner/ }).click();
      await dialog.getByRole("button", { name: "Copy style" }).click();
      await expect(page.getByText("Style copied to 1 widget")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      const { rows: [corner] } = await pool.query(`SELECT theme, draft_config FROM widget_configs WHERE id = $1`, [cornerId]);
      expect(corner.draft_config.theme).toMatchObject({ primaryColor: "#112233", mode: "dark", borderRadius: 30 });
      expect(corner.draft_config.template).toBe("floating-card"); // its own layout
      expect(corner.theme.primaryColor).not.toBe("#112233"); // not live

      // The target now shows its unpublished changes on the list
      await page.reload();
      await expect(page.getByText("Unpublished changes").first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("style experiment: a variant is a layout and a look, its name follows the choices, and it is saved as a style test", async ({ browser, baseURL }) => {
    const { context, page } = await owner(browser, baseURL!);
    try {
      await open(page, `/spaces/${spaceId}/experiments`);
      await page.getByRole("button", { name: /New Experiment|Create Experiment/ }).first().click();
      const dialog = page.getByRole("dialog", { name: "Create experiment" });
      await dialog.getByPlaceholder(/Exit Intent vs/).fill("E2E looks");
      await dialog.getByRole("button", { name: /style/i }).first().click();

      // Variant A is the widget as it is; B starts as Dark cinema. Pick a layout for B and watch its name follow
      const nameB = dialog.getByPlaceholder("Variant B Name");
      const selects = dialog.locator("select"); // A's layout and look, then B's
      await expect(nameB).toHaveValue("Dark cinema");
      await selects.nth(2).selectOption({ label: "Carousel" });
      await expect(nameB).toHaveValue("Carousel, Dark cinema");
      await selects.nth(3).selectOption({ label: "Soft" });
      await expect(nameB).toHaveValue("Carousel, Soft");

      await dialog.getByRole("button", { name: "Save as Draft" }).click();
      await expect(page.getByText(/Experiment created successfully as draft/)).toBeVisible();

      const { rows: [exp] } = await pool.query(`SELECT type, variants FROM experiments WHERE space_id = $1 AND name = 'E2E looks'`, [spaceId]);
      expect(exp.type).toBe("style");
      expect(exp.variants).toEqual([
        { id: "control", name: "Current look", config: {} },
        { id: "variant-b", name: "Carousel, Soft", config: { template: "carousel", preset: "soft" } },
      ]);

      // The API refuses a style variant that carries anything else
      const bad = await context.request.post(`/api/spaces/${spaceId}/experiments`, {
        headers: { origin: baseURL! },
        data: { name: "Bad", type: "style", variants: [{ id: "a", name: "A", config: {} }, { id: "b", name: "B", config: { theme: { primaryColor: "#ff0000" } } }], trafficSplit: [50, 50] },
      });
      expect(bad.status()).toBe(400);
    } finally {
      await context.close();
    }
  });
});
