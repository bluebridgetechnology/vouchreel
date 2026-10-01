import { describe, it, expect, vi, beforeEach } from "vitest";
import { attemptDelivery } from "../deliver";

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
  });
});
