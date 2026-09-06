import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock, getUserMock, fromMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({
    auth: { getUser: getUserMock },
    from: fromMock,
  }),
}));

import { tilesForLinks, requireVendorSession } from "./vendor";
import { LEGAL_VERSIONS } from "@merqo/ui";

function mockMerqoTeamTable() {
  const maybeSingle = async () => ({ data: null, error: null });
  return { select: () => ({ eq: () => ({ maybeSingle }) }) };
}

function mockLegalAcceptancesTable(
  rows: { doc_type: string; doc_version: string; accepted_at?: string }[],
) {
  const order = vi.fn((column: string, opts: { ascending: boolean }) => {
    const sorted = [...rows].sort((a, b) => {
      const av = String(a[column as keyof typeof a] ?? "");
      const bv = String(b[column as keyof typeof b] ?? "");
      const cmp = av.localeCompare(bv);
      return opts.ascending ? cmp : -cmp;
    });
    return Promise.resolve({ data: sorted, error: null });
  });
  return { select: () => ({ eq: () => ({ order }) }) };
}

function mockVendorLinksTable() {
  const eq = async () => ({ data: [], error: null });
  return { select: () => ({ eq }) };
}

// requireVendorSession issues three .from() calls when a user is signed in:
// merqo_team (loadVendorContext), vendor_links (loadVendorContext), and
// legal_acceptances (the new gate). Route each by table name so a test only
// has to override the row it cares about.
function mockFrom(overrides: {
  legalAcceptances?: {
    doc_type: string;
    doc_version: string;
    accepted_at?: string;
  }[];
}) {
  fromMock.mockImplementation((table: string) => {
    if (table === "merqo_team") return mockMerqoTeamTable();
    if (table === "legal_acceptances")
      return mockLegalAcceptancesTable(overrides.legalAcceptances ?? []);
    return mockVendorLinksTable();
  });
}

describe("requireVendorSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom({});
  });

  it("redirects to /login when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await requireVendorSession();

    expect(redirectMock).toHaveBeenCalledWith("/login");
  });

  it("returns the vendor context without redirecting when signed in and legal acceptance is current", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    mockFrom({
      legalAcceptances: [
        {
          doc_type: "terms",
          doc_version: LEGAL_VERSIONS.terms,
          accepted_at: "2026-09-05T00:00:00Z",
        },
        {
          doc_type: "privacy",
          doc_version: LEGAL_VERSIONS.privacy,
          accepted_at: "2026-09-05T00:00:00Z",
        },
      ],
    });

    const result = await requireVendorSession();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result.user.id).toBe("u1");
    expect(result.isTeam).toBe(false);
    expect(result.links).toEqual([]);
  });

  it("redirects to /legal/accept when the signed-in vendor has never accepted", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    mockFrom({ legalAcceptances: [] });

    await requireVendorSession();

    expect(redirectMock).toHaveBeenCalledWith("/legal/accept");
  });

  it("redirects to /legal/accept when the vendor's acceptance is stale (older version)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    mockFrom({
      legalAcceptances: [
        {
          doc_type: "terms",
          doc_version: "2020-01-01",
          accepted_at: "2020-01-01T00:00:00Z",
        },
        {
          doc_type: "privacy",
          doc_version: LEGAL_VERSIONS.privacy,
          accepted_at: "2026-09-05T00:00:00Z",
        },
      ],
    });

    await requireVendorSession();

    expect(redirectMock).toHaveBeenCalledWith("/legal/accept");
  });

  it("redirects when the vendor's most-recently-accepted (by accepted_at) terms version is stale, even though an earlier acceptance of the current version has a higher doc_version string", async () => {
    // Row order here deliberately disagrees between doc_version's string
    // sort and accepted_at's real order: the vendor accepted the CURRENT
    // version long ago, then most recently (re-)accepted an OLDER, stale
    // version. Sorting by doc_version desc would pick the current-version
    // row (its string sorts highest) and wrongly conclude "current" — this
    // only redirects if the gate orders by accepted_at descending instead,
    // reflecting the vendor's actual latest action.
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    mockFrom({
      legalAcceptances: [
        {
          doc_type: "terms",
          doc_version: LEGAL_VERSIONS.terms,
          accepted_at: "2020-01-01T00:00:00Z",
        },
        {
          doc_type: "terms",
          doc_version: "2020-01-01",
          accepted_at: "2026-09-05T00:00:00Z",
        },
        {
          doc_type: "privacy",
          doc_version: LEGAL_VERSIONS.privacy,
          accepted_at: "2026-09-05T00:00:00Z",
        },
      ],
    });

    await requireVendorSession();

    expect(redirectMock).toHaveBeenCalledWith("/legal/accept");
  });
});

describe("tilesForLinks", () => {
  it("buckets active, waitlist, and needs_setup links separately", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "free" },
      { product_slug: "shopkit", status: "waitlist", plan: null },
      { product_slug: "paykit", status: "needs_setup", plan: null },
    ]);
    expect(active.map((t) => t.slug)).toEqual(["qkit"]);
    expect(pending.map((t) => t.slug)).toEqual(["shopkit"]);
    expect(needsSetup.map((t) => t.slug)).toEqual(["paykit"]);
  });

  it("drops a link to a slug KITS doesn't know about, in any bucket", () => {
    const { active, pending, needsSetup } = tilesForLinks([
      { product_slug: "unknown-kit", status: "needs_setup", plan: null },
    ]);
    expect(active).toEqual([]);
    expect(pending).toEqual([]);
    expect(needsSetup).toEqual([]);
  });

  it("never sets plan on a needs_setup tile (plan only means anything once active)", () => {
    const { needsSetup } = tilesForLinks([
      { product_slug: "paykit", status: "needs_setup", plan: "pro" },
    ]);
    expect(needsSetup[0].plan).toBeUndefined();
  });

  it("still populates plan on an active tile", () => {
    const { active } = tilesForLinks([
      { product_slug: "qkit", status: "active", plan: "pro" },
    ]);
    expect(active[0].plan).toBe("pro");
  });
});
