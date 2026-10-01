import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { VouchreelWidget } from "../widget";
import type { TestimonialItem } from "../matcher";

describe("Widget White-Label Branding (Sprint 14)", () => {
  const mockTestimonials: TestimonialItem[] = [
    {
      id: "t-1",
      customerName: "Jane Doe",
      videoUrl: "https://example.com/video.mp4",
      quote: "Amazing experience!",
      rating: 5,
    },
  ];

  function createMockElement(tag: string) {
    const children: any[] = [];
    const classListSet = new Set<string>();
    const attributes: Record<string, string> = {};

    const el: any = {
      tagName: tag.toUpperCase(),
      className: "",
      innerHTML: "",
      textContent: "",
      style: {},
      children,
      classList: {
        add: (...classes: string[]) => {
          classes.forEach((c) => classListSet.add(c));
          el.className = Array.from(classListSet).join(" ");
        },
        remove: (...classes: string[]) => {
          classes.forEach((c) => classListSet.delete(c));
          el.className = Array.from(classListSet).join(" ");
        },
        contains: (c: string) => classListSet.has(c),
      },
      appendChild: (child: any) => {
        children.push(child);
        return child;
      },
      setAttribute: (k: string, v: string) => {
        attributes[k] = v;
      },
      getAttribute: (k: string) => attributes[k] || null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      focus: vi.fn(),
      attachShadow: () => {
        const shadow = createMockElement("shadow-root");
        return shadow;
      },
      querySelector: (selector: string): any => {
        if (selector === ".vr-powered-by") {
          return findChildByClass(el, "vr-powered-by");
        }
        if (selector.includes("vr-powered-by-logo")) {
          return findChildByClass(el, "vr-powered-by-logo");
        }
        return null;
      },
    };
    return el;
  }

  function findChildByClass(node: any, className: string): any {
    if (
      node.className &&
      typeof node.className === "string" &&
      node.className.includes(className)
    ) {
      return node;
    }
    for (const child of node.children || []) {
      const match = findChildByClass(child, className);
      if (match) return match;
    }
    return null;
  }

  beforeEach(() => {
    const mockDoc = {
      createElement: (tag: string) => createMockElement(tag),
      createTextNode: (text: string) => ({ textContent: text, nodeType: 3 }),
      getElementById: vi.fn().mockReturnValue(null),
      querySelector: vi.fn().mockReturnValue(null),
      body: createMockElement("body"),
      documentElement: { lang: "en" },
      addEventListener: vi.fn(),
    };

    vi.stubGlobal("document", mockDoc);
    vi.stubGlobal("window", {
      location: { href: "https://client.com/", pathname: "/" },
      sessionStorage: { getItem: vi.fn(), setItem: vi.fn() },
      addEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("assigns whiteLabel settings correctly in constructor", () => {
    const widget = new VouchreelWidget({
      embedKey: "emb-123",
      config: { template: "floating-card" },
      testimonials: mockTestimonials,
      whiteLabel: {
        removeBranding: true,
        logoUrl: "https://custom.com/logo.png",
      },
    });

    expect((widget as any).whiteLabel).toEqual({
      removeBranding: true,
      logoUrl: "https://custom.com/logo.png",
    });
  });

  it("renders default 'Verified by Vouchreel' branding when removeBranding is false or undefined", () => {
    const widget = new VouchreelWidget({
      embedKey: "emb-123",
      config: { template: "floating-card" },
      testimonials: mockTestimonials,
      whiteLabel: {
        removeBranding: false,
      },
    });

    widget.mount();
    widget.expand(0);

    const shadow = (widget as any).shadowRoot;
    const poweredBy = shadow?.querySelector(".vr-powered-by");
    expect(poweredBy).toBeTruthy();
    const textChild = poweredBy?.children?.find((c: any) =>
      c.textContent?.includes("Verified by Vouchreel")
    );
    expect(textChild?.textContent || poweredBy?.textContent).toContain("Verified by Vouchreel");
  });

  it("hides 'Verified by Vouchreel' branding completely when removeBranding is true", () => {
    const widget = new VouchreelWidget({
      embedKey: "emb-123",
      config: { template: "floating-card" },
      testimonials: mockTestimonials,
      whiteLabel: {
        removeBranding: true,
      },
    });

    widget.mount();
    widget.expand(0);

    const shadow = (widget as any).shadowRoot;
    const poweredBy = shadow?.querySelector(".vr-powered-by");
    expect(poweredBy).toBeNull();
  });

  it("renders custom brand logo when logoUrl is specified", () => {
    const widget = new VouchreelWidget({
      embedKey: "emb-123",
      config: { template: "floating-card" },
      testimonials: mockTestimonials,
      whiteLabel: {
        removeBranding: false,
        logoUrl: "https://agency.com/logo.svg",
      },
    });

    widget.mount();
    widget.expand(0);

    const shadow = (widget as any).shadowRoot;
    const poweredBy = shadow?.querySelector(".vr-powered-by");
    expect(poweredBy).toBeTruthy();

    const logo = poweredBy?.querySelector(".vr-powered-by-logo");
    expect(logo).toBeTruthy();
    expect(logo?.src).toBe("https://agency.com/logo.svg");

    const textChild = poweredBy?.children?.find((c: any) =>
      c.textContent?.includes("Powered by our community")
    );
    expect(textChild?.textContent || poweredBy?.textContent).toContain("Powered by our community");
  });
});
