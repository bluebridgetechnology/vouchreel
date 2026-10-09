import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "@/components/ui/confirm";
import { WidgetsView, type WidgetListItem } from "../widgets-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const widget = (over: Partial<WidgetListItem> = {}): WidgetListItem => ({
  id: "w1",
  name: "Default widget",
  template: "floating-card",
  isLive: true,
  sortOrder: 0,
  hasDraft: false,
  publishedAt: "2026-10-01T00:00:00.000Z",
  createdAt: "2026-09-01T00:00:00.000Z",
  ...over,
});

const render = (widgets: WidgetListItem[], quota = { current: widgets.length, limit: 3 as number | null, allowed: true }) =>
  renderToStaticMarkup(
    <ConfirmProvider>
      <WidgetsView spaceId="space-1" embedKey="emb-key" widgets={widgets} quota={quota} />
    </ConfirmProvider>
  );

describe("widgets page", () => {
  it("lists each widget with its name linking to its own editor, its layout and where it sits", () => {
    const html = render([widget(), widget({ id: "w2", name: "Footer wall", template: "wall-of-love", sortOrder: 1 })]);
    expect(html).toContain('href="/spaces/space-1/widget/w1"');
    expect(html).toContain('href="/spaces/space-1/widget/w2"');
    expect(html).toContain("Footer wall");
    expect(html).toContain("Floating card · floats in a corner");
    expect(html).toContain("Wall of love · sits in your page");
  });

  it("marks only the first as primary, and says how many the plan allows", () => {
    const html = render([widget(), widget({ id: "w2", sortOrder: 1 })], { current: 2, limit: 3, allowed: true });
    expect(html.match(/Primary/g)).toHaveLength(1);
    expect(html).toContain("2 of 3 widgets");
    expect(html).not.toContain("Upgrade to add more");
  });

  it("says Live, Off or Not live yet, and flags a live widget's unpublished changes", () => {
    const html = render([
      widget({ id: "a", name: "A", hasDraft: true }),
      widget({ id: "b", name: "B", isLive: false }),
      widget({ id: "c", name: "C", isLive: false, publishedAt: null }),
    ]);
    expect(html).toContain("Live");
    expect(html).toContain("Off");
    expect(html).toContain("Not live yet");
    expect(html.match(/Unpublished changes/g)).toHaveLength(1);
  });

  it("each widget has a switch for showing it on the site, named for it, on or off to match", () => {
    const html = render([widget({ name: "A" }), widget({ id: "b", name: "B", isLive: false })]);
    expect(html).toContain('aria-label="A is shown to visitors"');
    expect(html).toMatch(/aria-label="A is shown to visitors"[^>]*data-state="checked"|data-state="checked"[^>]*aria-label="A is shown to visitors"/);
    expect(html).toMatch(/aria-label="B is shown to visitors"[^>]*data-state="unchecked"|data-state="unchecked"[^>]*aria-label="B is shown to visitors"/);
  });

  it("at the plan's limit it says so and links to the plans", () => {
    const html = render([widget()], { current: 1, limit: 1, allowed: false });
    expect(html).toContain("1 of 1 widget");
    expect(html).toContain("Your plan allows 1 widget per space. Upgrade to add more.");
    expect(html).toContain('href="/settings/billing"');
  });

  it("a plan with no limit just counts", () => {
    expect(render([widget(), widget({ id: "b" })], { current: 2, limit: null, allowed: true })).toContain("2 widgets");
  });

  it("explains one script for all widgets, with the install snippet", () => {
    const html = render([widget()]);
    expect(html).toContain("How to put widgets on your site");
    expect(html).toContain("One script serves every widget in this space");
    expect(html).toContain("emb-key");
  });

  it("writes a widget's name as text", () => {
    expect(render([widget({ name: "<img src=x onerror=alert(1)>" })])).not.toContain("<img src=x");
  });
});
