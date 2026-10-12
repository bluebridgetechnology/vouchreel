import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { isCanvasPath, SIDEBAR_COOKIE } from "@/lib/dashboard-shell";

vi.mock("next/navigation", () => ({ usePathname: () => "/spaces", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/notifications/notification-bell", () => ({ NotificationBell: () => <span data-testid="bell" /> }));
vi.mock("@/lib/auth/auth-client", () => ({ signOut: vi.fn() }));

import { DashboardSidebar } from "../dashboard-sidebar";

const user = { id: "u1", name: "Demo Agency", email: "demo@example.test", isPlatformAdmin: true };
const render = (collapsed: boolean, withToggle = true) => renderToStaticMarkup(<DashboardSidebar user={user} collapsed={collapsed} onToggle={withToggle ? () => undefined : undefined} />);

describe("the sidebar", () => {
  it("expanded: the wide sidebar with every label, the logo's name, and a button that collapses it", () => {
    const html = render(false);
    expect(html).toContain("w-64");
    for (const label of ["Home", "Spaces", "Agency", "Billing", "Settings", "Admin"]) expect(html).toContain(label);
    expect(html).toContain("Vouchreel");
    expect(html).toMatch(/aria-expanded="true"[^>]*aria-label="Collapse sidebar"|aria-label="Collapse sidebar"[^>]*aria-expanded="true"/);
    expect(html).toContain("demo@example.test");
  });

  it("collapsed: an icon rail whose links keep their names for screen readers and show them on hover, and a button that expands it", () => {
    const html = render(true);
    expect(html).toContain("w-[4.5rem]");
    expect(html).not.toContain("w-64");
    // Every link still has its name (visually hidden) and a tooltip
    for (const label of ["Home", "Spaces", "Agency", "Billing", "Settings", "Admin"]) {
      expect(html).toContain(`title="${label}"`);
      expect(html).toMatch(new RegExp(`class="sr-only">${label}<`));
    }
    expect(html).toMatch(/aria-expanded="false"[^>]*aria-label="Expand sidebar"|aria-label="Expand sidebar"[^>]*aria-expanded="false"/);
    // The email and the wordmark do not fit, but signing out still does, with a name
    expect(html).not.toContain("demo@example.test");
    expect(html).not.toContain(">Vouchreel<");
    expect(html).toContain('aria-label="Sign out"');
    // The page you are on is still marked
    expect(html).toMatch(/aria-current="page"[^>]*title="Spaces"|title="Spaces"[^>]*aria-current="page"/);
  });

  it("has no toggle when nothing can handle it", () => {
    expect(render(false, false)).not.toContain("aria-expanded");
  });
});

describe("canvas pages", () => {
  it("only the widget editor is a canvas: not the list, not other tabs, not the space", () => {
    expect(isCanvasPath("/spaces/abc/widget/def")).toBe(true);
    expect(isCanvasPath("/spaces/abc/widget/def/")).toBe(true);
    expect(isCanvasPath("/spaces/abc/widget")).toBe(false);
    expect(isCanvasPath("/spaces/abc/widget/def/extra")).toBe(false);
    expect(isCanvasPath("/spaces/abc/analytics")).toBe(false);
    expect(isCanvasPath("/spaces")).toBe(false);
    expect(isCanvasPath("/widget/def")).toBe(false);
  });

  it("the choice is remembered in a cookie the server can read", () => {
    expect(SIDEBAR_COOKIE).toBe("vr-sidebar");
  });
});
