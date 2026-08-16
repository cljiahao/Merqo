import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendTelegramMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));

// Chainable Supabase query-builder mock. `telegram_link_tokens` covers the
// token lookup (select) + burn (delete); the customer upsert itself goes
// through the merqo.upsert_customer_telegram RPC (not a second .from() —
// see supabase/migrations/0019_customer_telegram.sql's comment on why a
// plain .upsert() can't target a partial unique index). `vendor_telegram`
// (0020) grants service_role a plain table write — a vendor link is a
// direct .upsert(), no RPC needed (unlike customers, which has zero grants
// to anyone).
type QueryResult = { data: unknown; error: unknown };
let maybeSingleQueue: QueryResult[] = [];
const deleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
const vendorUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
const from = vi.fn((table: string) => {
  if (table === "telegram_link_tokens") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve(
              maybeSingleQueue.shift() ?? { data: null, error: null },
            ),
        }),
      }),
      delete: () => ({ eq: deleteEq }),
    };
  }
  if (table === "vendor_telegram") {
    return { upsert: vendorUpsert };
  }
  throw new Error(`unexpected table: ${table}`);
});
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({ from, rpc }),
}));

import { POST } from "./route";

const SECRET = "webhook-secret-xyz";
const ORIGINAL_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {
    "x-telegram-bot-api-secret-token": SECRET,
  },
): Request {
  return new Request("https://merqo.example.com/api/telegram/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.TELEGRAM_WEBHOOK_SECRET = SECRET;
  maybeSingleQueue = [];
  rpc.mockClear();
  rpc.mockResolvedValue({ data: null, error: null });
  deleteEq.mockClear();
  vendorUpsert.mockClear();
  vendorUpsert.mockResolvedValue({ data: null, error: null });
  from.mockClear();
  sendTelegramMessage.mockClear();
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
  else process.env.TELEGRAM_WEBHOOK_SECRET = ORIGINAL_SECRET;
});

describe("POST /api/telegram/webhook", () => {
  it("401s when the secret-token header is missing", async () => {
    const res = await POST(makeRequest({}, {}));
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("401s when the secret-token header is wrong", async () => {
    const res = await POST(
      makeRequest({}, { "x-telegram-bot-api-secret-token": "wrong" }),
    );
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("401s when TELEGRAM_WEBHOOK_SECRET is unset server-side (fails closed)", async () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
  });

  it("upserts the customer via RPC and deletes the token on a valid /start (kind='customer')", async () => {
    maybeSingleQueue = [
      {
        data: {
          vendor_id: "vendor-1",
          notify_ref: "qkit:order-42",
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          kind: "customer",
        },
        error: null,
      },
    ];
    const res = await POST(
      makeRequest({
        message: { text: "/start abc123", chat: { id: 999 } },
      }),
    );
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("upsert_customer_telegram", {
      p_vendor_id: "vendor-1",
      p_telegram_chat_id: 999,
      p_notify_ref: "qkit:order-42",
    });
    expect(deleteEq).toHaveBeenCalledWith("token", "abc123");
    expect(vendorUpsert).not.toHaveBeenCalled();
    expect(sendTelegramMessage).toHaveBeenCalledWith(999, expect.any(String));
  });

  it("upserts merqo.vendor_telegram (not the customer RPC) and deletes the token on a valid /start (kind='vendor')", async () => {
    maybeSingleQueue = [
      {
        data: {
          vendor_id: "vendor-9",
          notify_ref: null,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          kind: "vendor",
        },
        error: null,
      },
    ];
    const res = await POST(
      makeRequest({
        message: { text: "/start vendor-token-1", chat: { id: 777 } },
      }),
    );
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(vendorUpsert).toHaveBeenCalledWith(
      { vendor_id: "vendor-9", chat_id: 777 },
      { onConflict: "vendor_id" },
    );
    expect(deleteEq).toHaveBeenCalledWith("token", "vendor-token-1");
    expect(sendTelegramMessage).toHaveBeenCalledWith(777, expect.any(String));
  });

  it("writes nothing for an expired token, still responds 200", async () => {
    maybeSingleQueue = [
      {
        data: {
          vendor_id: "vendor-1",
          notify_ref: "qkit:order-42",
          expires_at: new Date(Date.now() - 60_000).toISOString(),
          kind: "customer",
        },
        error: null,
      },
    ];
    const res = await POST(
      makeRequest({
        message: { text: "/start expired-token", chat: { id: 999 } },
      }),
    );
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("writes nothing for an unknown token, still responds 200", async () => {
    maybeSingleQueue = [{ data: null, error: null }];
    const res = await POST(
      makeRequest({
        message: { text: "/start no-such-token", chat: { id: 999 } },
      }),
    );
    expect(res.status).toBe(200);
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("always responds 200 to a Telegram-shaped payload that isn't a /start", async () => {
    const res = await POST(
      makeRequest({ message: { text: "hello", chat: { id: 1 } } }),
    );
    expect(res.status).toBe(200);
    expect(from).not.toHaveBeenCalled();
  });

  it("responds 200 (not 500) even when the internal lookup throws", async () => {
    maybeSingleQueue = [];
    from.mockImplementationOnce(() => {
      throw new Error("db unreachable");
    });
    const res = await POST(
      makeRequest({
        message: { text: "/start abc123", chat: { id: 999 } },
      }),
    );
    expect(res.status).toBe(200);
  });

  it("responds 200 (not 500) on a malformed JSON body", async () => {
    const req = new Request("https://merqo.example.com/api/telegram/webhook", {
      method: "POST",
      headers: { "x-telegram-bot-api-secret-token": SECRET },
      body: "not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
