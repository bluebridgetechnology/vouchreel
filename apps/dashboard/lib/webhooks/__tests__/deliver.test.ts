import { describe, it, expect, vi, beforeEach } from "vitest";
import { attemptDelivery } from "../deliver";
import { notifySpaceOwner } from "@/lib/notifications/service";

vi.mock("@/lib/notifications/service", () => ({ notifySpaceOwner: vi.fn() }));

// Keep tests offline: DNS is not consulted. Individual tests make the guard reject.
const assertPublicUrl = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/ssrf", () => ({
  assertPublicUrl,
  UnsafeUrlError: class UnsafeUrlError extends Error {},
}));

const mockDbUpdate = vi.fn();
const mockDbSelect = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    select: () => mockDbSelect(),
    update: () => mockDbUpdate(),
  },
}));

describe("Webhook Delivery Executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertPublicUrl.mockResolvedValue(new URL("https://example.com/webhook"));
  });

  it("never sends to a URL that now resolves to an internal address", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
    assertPublicUrl.mockRejectedValueOnce(new Error("The hostname resolves to an internal or private address."));
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ attemptCount: 0, maxAttempts: 4 }]) }),
    });
    const setMock = vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) }));
    mockDbUpdate.mockReturnValue({ set: setMock });

    await attemptDelivery("del-1", "https://rebind.example.com/hook", "secret", "testimonial.created", { id: "t" });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({ status: "retrying", attemptCount: 1 }));
  });

  it("does not follow redirects when delivering", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 302, text: () => Promise.resolve("") });
    vi.stubGlobal("fetch", mockFetch);
    mockDbSelect.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ attemptCount: 0, maxAttempts: 4 }]) }),
    });
    mockDbUpdate.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) });

    await attemptDelivery("del-2", "https://example.com/webhook", "secret", "testimonial.created", { id: "t" });

    expect(mockFetch.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("successfully marks delivery as success when destination responds with 200", async () => {
    // Mock fetch
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("OK"),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ count: 0 }]),
      }),
    });

    const setMock = vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    }));
    mockDbUpdate.mockReturnValue({ set: setMock });

    await attemptDelivery(
      "del-123",
      "https://example.com/webhook",
      "secret-abc",
      "testimonial.created",
      { id: "test-1" }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Vouchreel-Event": "testimonial.created",
          "User-Agent": "Vouchreel-Webhooks/1.0",
        }),
      })
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        httpStatus: 200,
      })
    );
  });

  it("schedules exponential retry when delivery fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Error"),
    });
    vi.stubGlobal("fetch", mockFetch);

    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ attemptCount: 0, maxAttempts: 4 }]),
      }),
    });

    const setMock = vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    }));
    mockDbUpdate.mockReturnValue({ set: setMock });

    await attemptDelivery(
      "del-123",
      "https://example.com/webhook",
      "secret-abc",
      "testimonial.created",
      { id: "test-1" }
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "retrying",
        httpStatus: 500,
        attemptCount: 1,
      })
    );
  });

  it("marks as failed when max attempts are exhausted", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", mockFetch);

    mockDbSelect.mockReturnValue({
      from: () => ({
        where: () => Promise.resolve([{ attemptCount: 3, maxAttempts: 4 }]),
        innerJoin: () => ({
          where: () => Promise.resolve([{ id: "ep-1", spaceId: "space-1", url: "https://example.com/webhook" }]),
        }),
      }),
    });

    const setMock = vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    }));
    mockDbUpdate.mockReturnValue({ set: setMock });

    await attemptDelivery(
      "del-123",
      "https://example.com/webhook",
      "secret-abc",
      "testimonial.created",
      { id: "test-1" }
    );

    expect(setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        attemptCount: 4,
        nextRetryAt: null,
      })
    );
    // Exhausted retries notify the space owner once per endpoint
    expect(notifySpaceOwner).toHaveBeenCalledWith(
      "space-1",
      expect.objectContaining({ type: "webhook.failing", dedupeKey: "webhook-failing:ep-1" })
    );
  });
});
