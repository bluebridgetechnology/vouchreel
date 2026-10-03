import { describe, expect, it } from "vitest";
import {
  createCollectionFormSchema,
  submissionMetaSchema,
  updateCollectionFormSchema,
} from "../collection-forms";

describe("collection form validation", () => {
  it("requires an incentive value for incentives", () => {
    expect(
      createCollectionFormSchema.safeParse({
        title: "Feedback",
        promptText: "Tell us about your experience",
        incentiveType: "discount",
      }).success
    ).toBe(false);
  });

  it("accepts a basic collection form", () => {
    expect(
      createCollectionFormSchema.safeParse({
        title: "Feedback",
        promptText: "Tell us about your experience",
      }).success
    ).toBe(true);
  });

  it("accepts partial form updates without forcing an incentive", () => {
    expect(updateCollectionFormSchema.safeParse({ title: "Updated" }).success).toBe(true);
  });
});

describe("collection type (collectModes)", () => {
  const base = { title: "Feedback", promptText: "Tell us" };

  it("defaults new forms to both video and written", () => {
    expect(createCollectionFormSchema.parse(base).collectModes).toBe("both");
  });

  it.each(["both", "video", "text"])("accepts %s", (collectModes) => {
    expect(createCollectionFormSchema.safeParse({ ...base, collectModes }).success).toBe(true);
    expect(updateCollectionFormSchema.safeParse({ collectModes }).success).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(createCollectionFormSchema.safeParse({ ...base, collectModes: "audio" }).success).toBe(false);
  });

  it("does not inject a default on partial updates (would reset an existing choice)", () => {
    expect(updateCollectionFormSchema.parse({ title: "New title" })).not.toHaveProperty("collectModes");
  });
});

describe("public submission validation", () => {
  it("requires a valid customer identity", () => {
    expect(
      submissionMetaSchema.safeParse({
        customerName: "Sam",
        customerEmail: "sam@example.com",
        text: "A thoughtful testimonial",
      }).success
    ).toBe(true);
    expect(
      submissionMetaSchema.safeParse({
        customerName: "",
        customerEmail: "not-an-email",
      }).success
    ).toBe(false);
  });
});
