import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

const { createServiceClient } = await import("@/lib/supabase/server");

function req(body: unknown, auth = "Bearer test-secret") {
  return new Request("http://localhost/api/merqo/legal-accept", {
    method: "POST",
    headers: { authorization: auth, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.MERQO_CUSTOMER_SECRET = "test-secret";
  vi.mocked(createServiceClient).mockReset();
});

describe("POST /api/merqo/legal-accept", () => {
  it("rejects an unauthorized request", async () => {
    const res = await POST(req({}, "Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("rejects an invalid body", async () => {
    const res = await POST(req({ vendor_email: "not-an-email" }));
    expect(res.status).toBe(400);
  });

  it("rejects a body missing legal_name", async () => {
    const res = await POST(
      req({
        vendor_email: "vendor@example.com",
        auth_uid: "11111111-1111-1111-1111-111111111111",
        doc_type: "terms",
        doc_version: "2026-09-04",
        doc_sha256: "a".repeat(64),
        kit_slug: "qkit",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("inserts a valid acceptance and returns ok", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => ({ insert }),
    } as never);

    const res = await POST(
      req({
        vendor_email: "vendor@example.com",
        auth_uid: "11111111-1111-1111-1111-111111111111",
        doc_type: "terms",
        doc_version: "2026-09-04",
        doc_sha256: "a".repeat(64),
        kit_slug: "qkit",
        legal_name: "Vendor Name",
      }),
    );
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalled();
  });

  it("inserts the provided legal_name/ip/user_agent verbatim when the kit forwards its own real values", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => ({ insert }),
    } as never);

    const res = await POST(
      req(
        {
          vendor_email: "vendor@example.com",
          auth_uid: "11111111-1111-1111-1111-111111111111",
          doc_type: "terms",
          doc_version: "2026-09-04",
          doc_sha256: "a".repeat(64),
          kit_slug: "qkit",
          legal_name: "Vendor Name",
          ip: "203.0.113.9",
          user_agent: "kit-forwarded-agent/1.0",
        },
        "Bearer test-secret",
      ),
    );
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        legal_name: "Vendor Name",
        ip: "203.0.113.9",
        user_agent: "kit-forwarded-agent/1.0",
      }),
    );
  });

  it("falls back to its own request headers for ip/user_agent when the kit doesn't forward them", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => ({ insert }),
    } as never);

    const request = new Request("http://localhost/api/merqo/legal-accept", {
      method: "POST",
      headers: {
        authorization: "Bearer test-secret",
        "content-type": "application/json",
        "x-forwarded-for": "198.51.100.7",
        "user-agent": "kit-server-fetch/1.0",
      },
      body: JSON.stringify({
        vendor_email: "vendor@example.com",
        auth_uid: "11111111-1111-1111-1111-111111111111",
        doc_type: "terms",
        doc_version: "2026-09-04",
        doc_sha256: "a".repeat(64),
        kit_slug: "qkit",
        legal_name: "Vendor Name",
      }),
    });
    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: "198.51.100.7",
        user_agent: "kit-server-fetch/1.0",
      }),
    );
  });

  it("treats a duplicate-acceptance unique violation as success (idempotent)", async () => {
    const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
    vi.mocked(createServiceClient).mockResolvedValue({
      from: () => ({ insert }),
    } as never);

    const res = await POST(
      req({
        vendor_email: "vendor@example.com",
        auth_uid: "11111111-1111-1111-1111-111111111111",
        doc_type: "terms",
        doc_version: "2026-09-04",
        doc_sha256: "a".repeat(64),
        kit_slug: "qkit",
        legal_name: "Vendor Name",
      }),
    );
    expect(res.status).toBe(200);
  });
});
