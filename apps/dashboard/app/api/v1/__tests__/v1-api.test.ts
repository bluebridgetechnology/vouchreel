import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getSpaces } from "../spaces/route";
import { GET as getSingleSpace } from "../spaces/[id]/route";
import { GET as getTestimonials, POST as createTestimonial } from "../testimonials/route";
import * as apiKeysModule from "@/lib/api/api-keys";
import { enforceTestimonialLimit } from "@/lib/payments/enforce";
import { apiError } from "@/lib/api/errors";

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockDbSelect(),
    insert: () => mockDbInsert(),
  },
}));

vi.mock("@/lib/payments/enforce", () => ({
  enforceTestimonialLimit: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/webhooks/dispatch", () => ({
  dispatchWebhookEvent: vi.fn(() => Promise.resolve()),
}));

describe("Public v1 REST API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Authentication & Security", () => {
    it("returns 401 UNAUTHORIZED when no API key is provided", async () => {
      vi.spyOn(apiKeysModule, "authenticateApiKey").mockResolvedValueOnce(null);

      const request = new Request("https://api.vouchreel.com/api/v1/spaces");
      const res = await getSpaces(request);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 FORBIDDEN when accessing a space that does not belong to the API key", async () => {
      vi.spyOn(apiKeysModule, "authenticateApiKey").mockResolvedValueOnce({
        apiKeyId: "key-1",
        spaceId: "space-alpha",
        ownerId: "user-1",
      });

      const request = new Request("https://api.vouchreel.com/api/v1/spaces/space-beta", {
        headers: { Authorization: "Bearer vr_live_testkey" },
      });
      const res = await getSingleSpace(request, {
        params: Promise.resolve({ id: "space-beta" }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("GET /api/v1/spaces", () => {
    it("returns the space matching the API key", async () => {
      vi.spyOn(apiKeysModule, "authenticateApiKey").mockResolvedValueOnce({
        apiKeyId: "key-1",
        spaceId: "space-alpha",
        ownerId: "user-1",
      });

      mockDbSelect
        .mockReturnValueOnce({
          from: () => ({
            where: () =>
              Promise.resolve([
                {
                  id: "space-alpha",
                  name: "My Store Space",
                  embedKey: "embed-123",
                  createdAt: new Date(),
                },
              ]),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ value: 5 }]),
          }),
        });

      const request = new Request("https://api.vouchreel.com/api/v1/spaces", {
        headers: { Authorization: "Bearer vr_live_testkey" },
      });
      const res = await getSpaces(request);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.spaces).toHaveLength(1);
      expect(data.spaces[0].id).toBe("space-alpha");
      expect(data.spaces[0].testimonialCount).toBe(5);
    });
  });

  describe("POST /api/v1/testimonials", () => {
    it("rejects creation with 403 PLAN_LIMIT when the space is at its plan limit", async () => {
      vi.spyOn(apiKeysModule, "authenticateApiKey").mockResolvedValueOnce({
        apiKeyId: "key-1",
        spaceId: "space-alpha",
        ownerId: "user-1",
      });
      vi.mocked(enforceTestimonialLimit).mockResolvedValueOnce(
        apiError(403, "PLAN_LIMIT", "Testimonial limit reached (3/3). Upgrade your plan to add more.") as never
      );

      const res = await createTestimonial(
        new Request("https://api.vouchreel.com/api/v1/testimonials", {
          method: "POST",
          headers: { Authorization: "Bearer vr_live_testkey", "Content-Type": "application/json" },
          body: JSON.stringify({ title: "One too many", customerName: "Jane", quote: "Nice" }),
        })
      );

      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("PLAN_LIMIT");
      expect(enforceTestimonialLimit).toHaveBeenCalledWith("space-alpha");
      expect(mockDbInsert).not.toHaveBeenCalled();
    });

    it("creates a testimonial for the authenticated space", async () => {
      vi.spyOn(apiKeysModule, "authenticateApiKey").mockResolvedValueOnce({
        apiKeyId: "key-1",
        spaceId: "space-alpha",
        ownerId: "user-1",
      });

      // Max sortOrder query
      mockDbSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ maxOrder: 2 }]),
        }),
      });

      // Insert returning
      mockDbInsert.mockReturnValueOnce({
        values: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: "test-new",
                spaceId: "space-alpha",
                title: "Great product!",
                customerName: "Jane Doe",
                sortOrder: 3,
                isActive: true,
              },
            ]),
        }),
      });

      const request = new Request("https://api.vouchreel.com/api/v1/testimonials", {
        method: "POST",
        headers: {
          Authorization: "Bearer vr_live_testkey",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Great product!",
          customerName: "Jane Doe",
          quote: "I love this app",
        }),
      });

      const res = await createTestimonial(request);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.testimonial.id).toBe("test-new");
      expect(data.testimonial.customerName).toBe("Jane Doe");
    });
  });
});
