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
