import { describe, it, expect, vi, beforeEach } from "vitest";

const { redirectMock, getUserMock, insertMock, fromMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
  getUserMock: vi.fn(),
  insertMock: vi.fn(),
  fromMock: vi.fn(),
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
  });

  it("redirects to /login when there is no signed-in user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    await acceptLegalTerms(formData());

    expect(redirectMock).toHaveBeenCalledWith("/login");
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("inserts both terms and privacy rows and redirects to the next param on success", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "u1", email: "Vendor@Business.sg" } },
    });
    insertMock.mockResolvedValue({ error: null });

    await acceptLegalTerms(formData("/dashboard/settings"));

    expect(fromMock).toHaveBeenCalledWith("legal_acceptances");
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        vendor_email: "vendor@business.sg",
        auth_uid: "u1",
        doc_type: "terms",
        doc_version: "2026-09-04",
        kit_slug: "merqo",
      }),
      expect.objectContaining({
        vendor_email: "vendor@business.sg",
        auth_uid: "u1",
        doc_type: "privacy",
        doc_version: "2026-09-04",
        kit_slug: "merqo",
      }),
    ]);
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
});
