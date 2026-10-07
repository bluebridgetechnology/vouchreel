import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({ delete: vi.fn() }));
vi.mock("@/lib/storage", () => ({ getStorage: () => storage }));

import { deleteVideoFile } from "../video-files";

describe("deleteVideoFile", () => {
  beforeEach(() => {
    storage.delete.mockReset();
    storage.delete.mockResolvedValue(undefined);
  });

  it("deletes the file the URL points at", async () => {
    expect(await deleteVideoFile("https://cdn.test/ai-videos/sp/t/v-abc.mp4", "ai")).toBe("deleted");
    expect(storage.delete).toHaveBeenCalledWith("ai-videos/sp/t/v-abc.mp4");
    expect(await deleteVideoFile("https://cdn.test/review-videos/sp/v-abc.mp4", "review")).toBe("deleted");
    expect(storage.delete).toHaveBeenLastCalledWith("review-videos/sp/v-abc.mp4");
  });

  it("does nothing for a video that has no URL", async () => {
    expect(await deleteVideoFile(null, "ai")).toBe("none");
    expect(await deleteVideoFile(undefined, "review")).toBe("none");
    expect(await deleteVideoFile("", "review")).toBe("none");
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("does not guess at a URL it does not recognise, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await deleteVideoFile("https://cdn.test/x.mp4", "ai")).toBe("unrecognized");
    expect(await deleteVideoFile("https://cdn.test/review-videos/sp/v.mp4", "ai")).toBe("unrecognized"); // wrong kind
    expect(await deleteVideoFile("https://cdn.test/ai-videos/../x.mp4", "ai")).toBe("unrecognized");
    expect(storage.delete).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("lets a storage failure through so the caller can leave things as they were", async () => {
    storage.delete.mockRejectedValueOnce(new Error("bucket unreachable"));
    await expect(deleteVideoFile("https://cdn.test/ai-videos/sp/t/v.mp4", "ai")).rejects.toThrow("bucket unreachable");
  });
});
