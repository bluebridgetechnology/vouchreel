import { describe, expect, it } from "vitest";
import { previewProps, type PreviewInput } from "../preview";
import type { ReviewOptionView, TemplateView } from "../ui-state";

const single: TemplateView = { id: "spotlight", label: "Spotlight", description: "", reviews: { min: 1, max: 1 }, requiresAggregate: false, maxChars: 400 };
const stack: TemplateView = { id: "stack", label: "Stack", description: "", reviews: { min: 3, max: 5 }, requiresAggregate: false, maxChars: 240 };
const rating: TemplateView = { id: "rating-spotlight", label: "Rating", description: "", reviews: { min: 1, max: 1 }, requiresAggregate: true, maxChars: 320 };

const review = (id: string, over: Partial<ReviewOptionView> = {}): ReviewOptionView => ({
  id,
  author: `Author ${id}`,
  rating: 5,
  text: `Real review text for ${id}.`,
  source: "google",
  date: "March 2026",
  fits: ["spotlight", "stack", "rating-spotlight"],
  ...over,
});

const base: Omit<PreviewInput, "template" | "picked"> = { stats: [], brand: "#0a7d5a", style: null, brandStyle: null, secondary: undefined, brandSecondary: null };

describe("previewProps", () => {
  it("shows sample text until enough reviews are picked, and says so", () => {
    const empty = previewProps({ ...base, template: single, picked: [] });
    expect(empty.usingSample).toBe(true);
    expect(empty.props.reviews.length).toBeGreaterThan(0);

    const stackTwo = previewProps({ ...base, template: stack, picked: [review("a"), review("b")] });
    expect(stackTwo.usingSample).toBe(true);
    expect(stackTwo.props.reviews.length).toBeGreaterThanOrEqual(3);
  });

  it("shows the real picks, verbatim and in order, once there are enough", () => {
    const result = previewProps({ ...base, template: stack, picked: [review("c"), review("a"), review("b")] });
    expect(result.usingSample).toBe(false);
    expect(result.props.reviews.map((r) => r.author)).toEqual(["Author c", "Author a", "Author b"]);
    expect(result.props.reviews[0].text).toBe("Real review text for c.");
    expect(result.props.reviews[0].date).toBe("March 2026");
  });

  it("uses the colour being chosen, falling back to the default for partial or invalid input", () => {
    expect(previewProps({ ...base, template: single, picked: [] }).props.brand).toBe("#0a7d5a");
    expect(previewProps({ ...base, template: single, picked: [], brand: "#0a7" }).props.brand).toMatch(/^#[0-9a-f]{6}$/i);
    expect(previewProps({ ...base, template: single, picked: [], brand: "red" }).props.brand).not.toBe("red");
  });

  it("resolves the font the way the server does: this video, then the brand kit, then the template's own", () => {
    expect(previewProps({ ...base, template: single, picked: [] }).props.theme).toBeUndefined();
    expect(previewProps({ ...base, template: single, picked: [], brandFont: "lora" }).props.theme).toEqual({ font: "lora" });
    expect(previewProps({ ...base, template: single, picked: [], brandFont: "lora", font: "caveat" }).props.theme).toEqual({ font: "caveat" });
    expect(previewProps({ ...base, template: single, picked: [], style: "dark", font: "nunito" }).props.theme).toEqual({ style: "dark", font: "nunito" });
  });

  it("resolves the style the way the server does: this video, then the brand kit, then the template's own", () => {
    expect(previewProps({ ...base, template: single, picked: [] }).props.theme).toBeUndefined();
    expect(previewProps({ ...base, template: single, picked: [], brandStyle: "aurora" }).props.theme).toEqual({ style: "aurora" });
    expect(previewProps({ ...base, template: single, picked: [], brandStyle: "aurora", style: "dark" }).props.theme).toEqual({ style: "dark" });
  });

  it("resolves the second colour: undefined = brand default, null = none, a colour = that colour", () => {
    const withKit = { ...base, template: single, picked: [], style: "gradient" as const, brandSecondary: "#1d4ed8" };
    expect(previewProps({ ...withKit, secondary: undefined }).props.theme).toEqual({ style: "gradient", secondary: "#1d4ed8" });
    expect(previewProps({ ...withKit, secondary: null }).props.theme).toEqual({ style: "gradient" });
    expect(previewProps({ ...withKit, secondary: "#ff00aa" }).props.theme).toEqual({ style: "gradient", secondary: "#ff00aa" });
    expect(previewProps({ ...withKit, secondary: "blue" }).props.theme).toEqual({ style: "gradient" });
  });

  it("the rating template uses the real provider totals when known, sample totals otherwise", () => {
    const real = previewProps({ ...base, template: rating, picked: [review("a")], stats: [{ source: "trustpilot", rating: 4.6, total: 1200 }] });
    expect(real.props.aggregate).toEqual({ source: "trustpilot", rating: 4.6, total: 1200 });
    expect(previewProps({ ...base, template: rating, picked: [review("a")] }).props.aggregate).toBeTruthy();
    expect(previewProps({ ...base, template: single, picked: [review("a")] }).props.aggregate).toBeUndefined();
  });
});
