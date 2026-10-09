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
    const order = vi.fn();
    const limit = vi.fn();
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => {
        let document = "";
        const query = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((column: string, value: string) => {
            if (column === "doc_type") document = value;
            return query;
          }),
          order: vi.fn((column: string, options: { ascending: boolean }) => {
            order(column, options);
            return query;
          }),
          limit: vi.fn(async (n: number) => {
            limit(n);
            return {
              data: rows
                .filter((row) => row.doc_type === document)
                .sort((a, b) => b.accepted_at.localeCompare(a.accepted_at))
                .slice(0, n),
              error: null,
            };
          }),
        };
        return query;
      },
    } as never);
    const res = await GET(req("vendor@example.com"));
    const body = await res.json();
    expect(order).toHaveBeenCalledWith("accepted_at", { ascending: false });
    expect(limit).toHaveBeenCalledTimes(3);
    expect(limit).toHaveBeenCalledWith(1);
    expect(body).toEqual({
      terms: "2026-09-04",
      privacy: "2026-09-04",
      pilot: null,
    });
  });

  it("returns 500 when the read fails", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "db unreachable" },
      }),
    };
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => query,
    } as never);
    const res = await GET(req("vendor@example.com"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "read failed" });
  });
});

it.each(["not-an-email", "   ", "vendor@example.com\nother@example.com"])(
  "rejects invalid legal-status email %j before opening the service client",
  async (email) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => query,
    } as never);
    const response = await GET(req(email));
    expect(response.status).toBe(400);
    expect(createServiceClient).not.toHaveBeenCalled();
  },
);
