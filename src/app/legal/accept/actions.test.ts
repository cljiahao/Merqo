import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock, getUserMock, insertMock, fromMock, headersMock } =
  vi.hoisted(() => ({
    redirectMock: vi.fn(),
    getUserMock: vi.fn(),
    insertMock: vi.fn(),
    fromMock: vi.fn(),
    headersMock: vi.fn(),
  }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { getUser: getUserMock } }),
  createServiceClient: async () => ({ from: fromMock }),
}));
vi.mock("@merqo/ui", () => ({
  getLegalDocSource: (doc: string) => `${doc}-source`,
  LEGAL_VERSIONS: { terms: "2026-09-04", privacy: "2026-09-04" },
}));

vi.mock("next/headers", () => ({ headers: headersMock }));

import { acceptLegalTerms } from "./actions";

function formData(next?: string): FormData {
  const fd = new FormData();
  if (next) fd.set("next", next);
  return fd;
}

describe("acceptLegalTerms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation(() => ({ insert: insertMock }));
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-for": "203.0.113.9",
        "user-agent": "test-agent/1.0",
      }),
    );
  });

  it("redirects to /login when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await acceptLegalTerms(formData());

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts terms and privacy as two independent rows and redirects to the next param on success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "Vendor@Business.sg" } },
    });
    insertMock.mockResolvedValue({ error: null });

    await acceptLegalTerms(formData("/dashboard/settings"));

    expect(fromMock).toHaveBeenCalledWith("legal_acceptances");
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        vendor_email: "vendor@business.sg",
        auth_uid: "u1",
        doc_type: "terms",
        doc_version: "2026-09-04",
        kit_slug: "merqo",
        ip: "203.0.113.9",
        user_agent: "test-agent/1.0",
      }),
    );
    expect(insertMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        vendor_email: "vendor@business.sg",
        auth_uid: "u1",
        doc_type: "privacy",
        doc_version: "2026-09-04",
        kit_slug: "merqo",
        ip: "203.0.113.9",
        user_agent: "test-agent/1.0",
      }),
    );
    expect(redirectMock).toHaveBeenCalledWith("/dashboard/settings");
  });

  it("redirects to /dashboard when no next param is given", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    insertMock.mockResolvedValue({ error: null });

    await acceptLegalTerms(formData());

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("tolerates a duplicate-insert (23505) unique violation as success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    insertMock.mockResolvedValue({ error: { code: "23505" } });

    await acceptLegalTerms(formData("/dashboard"));

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("throws on a real insert error (not a duplicate)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    insertMock.mockResolvedValue({ error: { code: "500", message: "boom" } });

    await expect(acceptLegalTerms(formData("/dashboard"))).rejects.toThrow(
      "boom",
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("inserts privacy successfully even when terms conflicts (23505) — independent per-doc-type idempotency", async () => {
    // Old single batched insert([rows]) would have dropped privacy here too.
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    insertMock.mockImplementation(async (row: { doc_type: string }) => {
      if (row.doc_type === "terms") {
        return { error: { code: "23505" } };
      }
      return { error: null };
    });

    await acceptLegalTerms(formData("/dashboard"));

    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ doc_type: "privacy" }),
    );
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("rejects an unsafe absolute/protocol-relative next and falls back to /dashboard", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    insertMock.mockResolvedValue({ error: null });

    await acceptLegalTerms(formData("https://evil.example"));
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");

    redirectMock.mockClear();
    await acceptLegalTerms(formData("//evil.example"));
    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
  });

  it("preserves a legitimate relative next path", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "vendor@business.sg" } },
    });
    insertMock.mockResolvedValue({ error: null });

    await acceptLegalTerms(formData("/admin"));

    expect(redirectMock).toHaveBeenCalledWith("/admin");
  });

  describe("client IP resolution", () => {
    beforeEach(() => {
      getUserMock.mockResolvedValue({
        data: { user: { id: "u1", email: "vendor@business.sg" } },
      });
      insertMock.mockResolvedValue({ error: null });
    });

    it("takes the first hop of a multi-value x-forwarded-for", async () => {
      headersMock.mockResolvedValue(
        new Headers({
          "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2",
        }),
      );

      await acceptLegalTerms(formData());

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "203.0.113.9" }),
      );
    });

    it("falls back to x-real-ip when x-forwarded-for is absent", async () => {
      headersMock.mockResolvedValue(
        new Headers({ "x-real-ip": "198.51.100.7" }),
      );

      await acceptLegalTerms(formData());

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "198.51.100.7" }),
      );
    });

    it('falls back to "unknown" when neither header is present', async () => {
      headersMock.mockResolvedValue(new Headers());

      await acceptLegalTerms(formData());

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ ip: "unknown" }),
      );
    });
  });
});
