import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: unknown }) => createElement("a", { href }, children as never),
}));
vi.mock("@/lib/auth/auth-client", () => ({
  signIn: { email: vi.fn(), social: vi.fn() },
  signUp: { email: vi.fn() },
}));

/**
 * Before React hydrates, a form without a working onSubmit falls back to the browser's native
 * submission: a GET to the same URL with every field (including the password) in the query
 * string. These tests lock in the two defences: the submit button starts disabled (which also
 * blocks Enter-to-submit) and the form's fallback method is POST, never GET.
 */
async function render(load: () => Promise<{ default?: unknown } & Record<string, unknown>>, name: string, props: object = {}) {
  const mod = await load();
  const Component = (name === "default" ? mod.default : mod[name]) as never;
  return renderToString(createElement(Component, props as never));
}

const forms = [
  ["login", () => import("../login/page"), "default", {}],
  ["signup", () => import("../signup/page"), "default", {}],
  ["forgot-password", () => import("../forgot-password/page"), "default", {}],
  ["reset-password", () => import("../reset-password/reset-password-form"), "ResetPasswordForm", { token: "tok" }],
] as const;

describe.each(forms)("%s form (server-rendered, pre-hydration)", (_label, load, name, props) => {
  it("falls back to POST, not GET, if submitted natively", async () => {
    const html = await render(load as never, name, props);
    expect(html).toMatch(/<form[^>]*method="post"/);
    expect(html).not.toMatch(/<form[^>]*method="get"/i);
  });

  it("renders the submit button disabled until hydration", async () => {
    const html = await render(load as never, name, props);
    const submit = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";
    // the attribute, not the "disabled:" Tailwind variants that appear in the class list
    expect(submit).toMatch(/\sdisabled(=""|\s|>)/);
  });
});
