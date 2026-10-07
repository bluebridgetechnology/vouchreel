import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

let formAccent: string | undefined;
let kit: Record<string, unknown> | null;

const rows = [
  [{ title: "T", promptText: null, incentiveType: "none", incentiveValue: null, collectModes: "both", spaceId: "sp", branding: { accentColor: formAccent } }],
  [{ ownerId: "o" }],
  [],
];
vi.mock("@/lib/db", () => ({
  db: {
    select: () => {
      const call = rowsQueue.shift() ?? [];
      return { from: () => ({ where: () => Promise.resolve(call) }) };
    },
  },
}));
let rowsQueue: unknown[][] = [];
vi.mock("@/lib/auth/feature-gate", () => ({ canAccess: vi.fn(async () => false) }));
vi.mock("@/lib/brand-kit/service", () => ({
  getBrandKit: vi.fn(async () => kit),
  toValues: (k: Record<string, unknown>) => k,
}));

const ctx = { params: Promise.resolve({ slug: "acme" }) };

describe("GET /api/collect/[slug] brand kit", () => {
  beforeEach(() => {
    formAccent = undefined;
    kit = null;
  });
  const load = () => {
    rowsQueue = [
      [{ ...rows[0][0], branding: { accentColor: formAccent } }],
      rows[1],
      rows[2],
    ];
    return GET(new Request("http://localhost/api/collect/acme"), ctx).then((r) => r.json());
  };

  it("sends no kit styling when the space has no kit", async () => {
    const { collectionForm } = await load();
    expect(collectionForm.branding).toMatchObject({ textColor: null, borderRadius: null });
  });

  it("applies the space's kit to the form", async () => {
    kit = { primaryColor: "#112233", accentColor: "#ffffff", borderRadius: 12 };
    const { collectionForm } = await load();
    expect(collectionForm.branding).toMatchObject({ accentColor: "#112233", textColor: "#ffffff", borderRadius: 12 });
  });

  it("keeps the form's own colour over the kit", async () => {
    formAccent = "#ffee00";
    kit = { primaryColor: "#112233", accentColor: "#ffffff", borderRadius: null };
    const { collectionForm } = await load();
    expect(collectionForm.branding.accentColor).toBe("#ffee00");
  });
});
