import { describe, it, expect, vi, beforeEach } from "vitest";

const customerNotifySecretOk = vi.fn();
vi.mock("@/lib/customer-notify-auth", () => ({
  customerNotifySecretOk: (...args: unknown[]) =>
    customerNotifySecretOk(...args),
}));

const sendTelegramMessage = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/telegram", () => ({
  sendTelegramMessage: (...args: unknown[]) => sendTelegramMessage(...args),
}));

type QueryResult = { data: unknown; error: unknown };
let maybeSingleResult: QueryResult = { data: null, error: null };
const from = vi.fn((table: string) => {
  if (table === "vendor_telegram") {
    return {
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve(maybeSingleResult),
        }),
      }),
    };
  }
  throw new Error(`unexpected table: ${table}`);
});
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({ from }),
}));

import { POST } from "./route";

const VENDOR_ID = "00000000-0000-0000-0000-000000000001";

function makeRequest(body: unknown): Request {
  return new Request("https://merqo.example.com/api/merqo/notify-vendor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  customerNotifySecretOk.mockReturnValue(true);
  maybeSingleResult = { data: null, error: null };
  from.mockClear();
  sendTelegramMessage.mockClear();
});

describe("POST /api/merqo/notify-vendor", () => {
  it("401s without a valid customerNotifySecretOk bearer", async () => {
    customerNotifySecretOk.mockReturnValue(false);
    const res = await POST(
      makeRequest({ vendor_id: VENDOR_ID, message: "New order!" }),
    );
    expect(res.status).toBe(401);
    expect(from).not.toHaveBeenCalled();
  });

  it("400s on a malformed body (missing message)", async () => {
    const res = await POST(makeRequest({ vendor_id: VENDOR_ID }));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("400s on invalid JSON", async () => {
    const req = new Request(
      "https://merqo.example.com/api/merqo/notify-vendor",
      { method: "POST", body: "not json" },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("sends via sendTelegramMessage when the vendor has a linked chat", async () => {
    maybeSingleResult = { data: { chat_id: 4242 }, error: null };
    const res = await POST(
      makeRequest({ vendor_id: VENDOR_ID, message: "New order placed!" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, sent: true });
    expect(sendTelegramMessage).toHaveBeenCalledWith(4242, "New order placed!");
  });

  it("is a silent 200 (no send, no error) when the vendor has no linked chat", async () => {
    maybeSingleResult = { data: null, error: null };
    const res = await POST(
      makeRequest({ vendor_id: VENDOR_ID, message: "New order placed!" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, sent: false });
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });

  it("is a silent 200 (no throw to the caller) when the lookup itself errors", async () => {
    maybeSingleResult = { data: null, error: { message: "db unreachable" } };
    const res = await POST(
      makeRequest({ vendor_id: VENDOR_ID, message: "New order placed!" }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ ok: true, sent: false });
    expect(sendTelegramMessage).not.toHaveBeenCalled();
  });
});
