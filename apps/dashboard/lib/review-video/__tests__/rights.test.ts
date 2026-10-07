import { describe, expect, it } from "vitest";
import { REVIEW_RIGHTS_DETAIL, REVIEW_RIGHTS_HEADLINE, REVIEW_RIGHTS_VERSION } from "../rights";

describe("review video rights wording", () => {
  it("has a version and the text the owner agrees to", () => {
    expect(REVIEW_RIGHTS_VERSION).toMatch(/^\d{4}-\d{2}-v\d+$/);
    expect(REVIEW_RIGHTS_HEADLINE).toMatch(/right to use these reviews/i);
    expect(REVIEW_RIGHTS_DETAIL).toMatch(/exactly as written/i);
  });
});
