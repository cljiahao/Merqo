import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

const { createServiceClient } = await import("@/lib/supabase/server");

beforeEach(() => {
  process.env.MERQO_CUSTOMER_SECRET = "test-secret";
  vi.mocked(createServiceClient).mockReset();
});

function req(email: string | null, auth = "Bearer test-secret") {
  const url = new URL("http://localhost/api/merqo/legal-status");
  if (email) url.searchParams.set("email", email);
  return new Request(url, { headers: { authorization: auth } });
}

describe("GET /api/merqo/legal-status", () => {
  it("rejects an unauthorized request", async () => {
    const res = await GET(req("vendor@example.com", "Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("requires an email query param", async () => {
    const res = await GET(req(null));
    expect(res.status).toBe(400);
  });

  it("returns the latest accepted version per doc_type, null when never accepted", async () => {
    // Rows are deliberately NOT pre-sorted by accepted_at, and doc_version's
    // string-sort order intentionally disagrees with accepted_at's real
    // order — so this only passes if the route sorts by accepted_at
    // descending, not by doc_version.
    const rows = [
      {
        doc_type: "terms",
        doc_version: "2099-01-01",
        accepted_at: "2026-01-01T00:00:00Z",
      },
      {
        doc_type: "terms",
        doc_version: "2026-09-04",
        accepted_at: "2026-09-04T00:00:00Z",
      },
      {
        doc_type: "privacy",
        doc_version: "2026-09-04",
        accepted_at: "2026-09-04T00:00:00Z",
      },
    ];
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockReturnThis();
    const order = vi.fn((column: string, opts: { ascending: boolean }) => {
      const sorted = [...rows].sort((a, b) => {
        const cmp = a.accepted_at.localeCompare(b.accepted_at);
        return opts.ascending ? cmp : -cmp;
      });
      return Promise.resolve({ data: sorted, error: null });
    });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => ({ select, eq, order }),
    } as never);

    const res = await GET(req("vendor@example.com"));
    const body = await res.json();
    expect(order).toHaveBeenCalledWith("accepted_at", { ascending: false });
    expect(body).toEqual({
      terms: "2026-09-04",
      privacy: "2026-09-04",
      pilot: null,
    });
  });
});
