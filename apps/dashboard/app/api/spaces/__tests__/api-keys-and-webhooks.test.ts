import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as listApiKeys, POST as createApiKey } from "../[id]/api-keys/route";
import { DELETE as deleteApiKey } from "../[id]/api-keys/[keyId]/route";
import { GET as listWebhooks, POST as createWebhook } from "../[id]/webhooks/route";
import { DELETE as deleteWebhook } from "../[id]/webhooks/[webhookId]/route";
import * as sessionModule from "@/lib/auth/session";

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbDelete = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockDbSelect(),
    insert: () => mockDbInsert(),
    delete: () => mockDbDelete(),
  },
}));

// Real guard logic, but DNS is stubbed so the tests stay offline
vi.mock("@/lib/security/ssrf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/ssrf")>();
  return {
    ...actual,
    assertPublicUrl: (raw: string) => actual.assertPublicUrl(raw, { resolve: async () => ["93.184.216.34"] }),
  };
});

describe("Dashboard API Keys and Webhooks Endpoints", () => {
  const fakeSession = {
    user: { id: "user-owner" },
    session: { id: "sess-1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("API Keys Route", () => {
    it("rejects unauthorized access when no session is present", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValueOnce(null as any);
      const res = await listApiKeys(new Request("https://app.vouchreel.com"), {
        params: Promise.resolve({ id: "space-1" }),
      });
      expect(res.status).toBe(401);
    });

    it("creates an API key and returns rawKey once", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValueOnce(fakeSession as any);

      // Verify space owner
      mockDbSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ id: "space-1", ownerId: "user-owner" }]),
        }),
      });

      // Insert returning
      mockDbInsert.mockReturnValueOnce({
        values: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: "key-1",
                name: "CI/CD Integration",
                keyPrefix: "vr_live_abcd...",
                isActive: true,
                createdAt: new Date(),
              },
            ]),
        }),
      });

      const req = new Request("https://app.vouchreel.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "CI/CD Integration" }),
      });

      const res = await createApiKey(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.apiKey.name).toBe("CI/CD Integration");
      expect(body.apiKey.rawKey.startsWith("vr_live_")).toBe(true);
    });

    it("deletes an API key for space owner", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValueOnce(fakeSession as any);

      // Verify space owner
      mockDbSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ id: "space-1", ownerId: "user-owner" }]),
        }),
      });

      mockDbDelete.mockReturnValueOnce({
        where: () => ({
          returning: () => Promise.resolve([{ id: "key-1" }]),
        }),
      });

      const res = await deleteApiKey(new Request("https://app.vouchreel.com"), {
        params: Promise.resolve({ id: "space-1", keyId: "key-1" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe("Webhooks Route", () => {
    it("creates a webhook endpoint and returns signing secret", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValueOnce(fakeSession as any);

      // Verify space owner
      mockDbSelect.mockReturnValueOnce({
        from: () => ({
          where: () => Promise.resolve([{ id: "space-1", ownerId: "user-owner" }]),
        }),
      });

      // Insert returning
      mockDbInsert.mockReturnValueOnce({
        values: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: "wh-1",
                url: "https://zapier.com/hooks/catch/123",
                events: ["testimonial.created"],
                isActive: true,
                createdAt: new Date(),
              },
            ]),
        }),
      });

      const req = new Request("https://app.vouchreel.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://zapier.com/hooks/catch/123",
          events: ["testimonial.created"],
        }),
      });

      const res = await createWebhook(req, {
        params: Promise.resolve({ id: "space-1" }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.webhook.url).toBe("https://zapier.com/hooks/catch/123");
      expect(body.webhook.secret.startsWith("whsec_")).toBe(true);
    });

    it("rejects webhook targets that point at internal addresses (SSRF)", async () => {
      for (const target of ["https://169.254.169.254/latest/meta-data", "https://127.0.0.1:8080/x", "https://localhost/hook", "https://10.0.0.5/hook"]) {
        vi.spyOn(sessionModule, "getSession").mockResolvedValueOnce(fakeSession as any);
        mockDbSelect.mockReturnValueOnce({
          from: () => ({ where: () => Promise.resolve([{ id: "space-1", ownerId: "user-owner" }]) }),
        });

        const res = await createWebhook(
          new Request("https://app.vouchreel.com", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: target, events: ["testimonial.created"] }),
          }),
          { params: Promise.resolve({ id: "space-1" }) }
        );

        expect(res.status).toBe(400);
        expect((await res.json()).error.details.url[0]).toMatch(/internal|private/i);
      }
      expect(mockDbInsert).not.toHaveBeenCalled();
    });
  });
});
