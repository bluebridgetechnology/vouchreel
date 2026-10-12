import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PagePreview } from "../page-preview";

const items = [
  { id: "a", title: "Everywhere", customerName: null, isActive: true, matchRules: { mode: "all", urlPatterns: [], tags: [] } },
  { id: "b", title: "Pricing only", customerName: null, isActive: true, matchRules: { mode: "specific", urlPatterns: ["/pricing"], tags: [] } },
  { id: "c", title: "Switched off", customerName: null, isActive: false, matchRules: { mode: "all", urlPatterns: [], tags: [] } },
];

describe("PagePreview", () => {
  it("starts on the home page: shows what matches it, hides what does not, ignores inactive ones", () => {
    const html = renderToStaticMarkup(<PagePreview items={items} />);
    expect(html).toContain("Shown here (1)");
    expect(html).toContain("Hidden here (1)");
    expect(html).toContain("Everywhere");
    expect(html).toContain("Pricing only");
    expect(html).not.toContain("Switched off");
  });
});
