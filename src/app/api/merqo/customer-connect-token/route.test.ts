import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const customerNotifySecretOk = vi.fn();
vi.mock("@/lib/customer-notify-auth", () => ({
  customerNotifySecretOk: (...args: unknown[]) =>
    customerNotifySecretOk(...args),
}));

const generateLinkToken = vi.fn().mockReturnValue("generated-token-abc");
vi.mock("@/lib/telegram", () => ({
  generateLinkToken: () => generateLinkToken(),
}));

const insert = vi.fn().mockResolvedValue({ data: null, error: null });
const from = vi.fn((table: string) => {
  if (table === "telegram_link_tokens") return { insert };
  throw new Error(`unexpected table: ${table}`);
});
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({ from }),
}));

import { POST } from "./route";

const ORIGINAL_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

function makeRequest(body: unknown): Request {
  return new Request(
    "https://merqo.example.com/api/merqo/customer-connect-token",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

beforeEach(() => {
  process.env.TELEGRAM_BOT_USERNAME = "MerqoNotifyBot";
  customerNotifySecretOk.mockReturnValue(true);
  generateLinkToken.mockReturnValue("generated-token-abc");
  insert.mockClear();
  insert.mockResolvedValue({ data: null, error: null });
  from.mockClear();
});

afterEach(() => {
  if (ORIGINAL_BOT_USERNAME === undefined)
    delete process.env.TELEGRAM_BOT_USERNAME;
  else process.env.TELEGRAM_BOT_USERNAME = ORIGINAL_BOT_USERNAME;
});

describe("POST /api/merqo/customer-connect-token", () => {
  it("401s without a valid customerNotifySecretOk bearer", async () => {
    customerNotifySecretOk.mockReturnValue(false);
    const res = await POST(
      makeRequest({
        vendor_id: "00000000-0000-0000-0000-000000000001",
        kit_slug: "qkit",
        notify_ref: "qkit:order-42",
      }),
    );
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("mints a token, inserts telegram_link_tokens with a 30-minute expiry, and returns the deep link", async () => {
    const before = Date.now();
    const res = await POST(
      makeRequest({
        vendor_id: "00000000-0000-0000-0000-000000000001",
        kit_slug: "qkit",
        notify_ref: "qkit:order-42",
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({
      token: "generated-token-abc",
      deep_link: "https://t.me/MerqoNotifyBot?start=generated-token-abc",
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRow = insert.mock.calls[0][0];
    expect(insertedRow).toMatchObject({
      token: "generated-token-abc",
      vendor_id: "00000000-0000-0000-0000-000000000001",
      kit_slug: "qkit",
      notify_ref: "qkit:order-42",
    });
    const expiresAt = new Date(insertedRow.expires_at).getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + 29 * 60 * 1000);
    expect(expiresAt).toBeLessThanOrEqual(before + 31 * 60 * 1000);
  });

  it("400s on a malformed body (missing field)", async () => {
    const res = await POST(
      makeRequest({ vendor_id: "00000000-0000-0000-0000-000000000001" }),
    );
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("400s on a malformed body (wrong type)", async () => {
    const res = await POST(
      makeRequest({ vendor_id: 12345, kit_slug: "qkit", notify_ref: "x" }),
    );
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("400s on invalid JSON", async () => {
    const req = new Request(
      "https://merqo.example.com/api/merqo/customer-connect-token",
      { method: "POST", body: "not json" },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
