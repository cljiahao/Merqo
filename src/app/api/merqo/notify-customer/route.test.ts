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

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: async () => ({ rpc }),
}));

import { POST } from "./route";

const VENDOR_ID = "00000000-0000-0000-0000-000000000001";

function makeRequest(body: unknown): Request {
  return new Request("https://merqo.example.com/api/merqo/notify-customer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  customerNotifySecretOk.mockReturnValue(true);
  rpc.mockReset();
  rpc.mockResolvedValue({ data: null, error: null });
  sendTelegramMessage.mockClear();
});

describe("POST /api/merqo/notify-customer", () => {
  it("401s without a valid customerNotifySecretOk bearer", async () => {
    customerNotifySecretOk.mockReturnValue(false);
    const res = await POST(
      makeRequest({
        vendor_id: VENDOR_ID,
        message: "Order ready",
        notify_ref: "qkit:order-42",
      }),
    );
    expect(res.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400s when both notify_ref and phone are given", async () => {
    const res = await POST(
      makeRequest({
        vendor_id: VENDOR_ID,
        message: "hi",
        notify_ref: "qkit:order-42",
        phone: "+6591234567",
      }),
    );
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("400s when neither notify_ref nor phone is given", async () => {
    const res = await POST(
      makeRequest({ vendor_id: VENDOR_ID, message: "hi" }),
    );
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  describe("notify_ref mode", () => {
    it("sends and clears the ref on a match (via the atomic claim RPC)", async () => {
      rpc.mockResolvedValue({ data: 999, error: null });
      const res = await POST(
        makeRequest({
          vendor_id: VENDOR_ID,
          message: "Your order is ready!",
          notify_ref: "qkit:order-42",
        }),
      );
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("claim_customer_by_notify_ref", {
        p_vendor_id: VENDOR_ID,
        p_notify_ref: "qkit:order-42",
      });
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        999,
        "Your order is ready!",
      );
    });

    it("is a silent 200 (no send) when no customer matches the ref", async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      const res = await POST(
        makeRequest({
          vendor_id: VENDOR_ID,
          message: "Your order is ready!",
          notify_ref: "qkit:order-nonexistent",
        }),
      );
      expect(res.status).toBe(200);
      expect(sendTelegramMessage).not.toHaveBeenCalled();
    });
  });

  describe("phone mode", () => {
    it("sends without clearing anything on a match (a standing connection, not single-use)", async () => {
      rpc.mockResolvedValue({ data: 555, error: null });
      const res = await POST(
        makeRequest({
          vendor_id: VENDOR_ID,
          message: "Reward redeemed!",
          phone: "+6591234567",
        }),
      );
      expect(res.status).toBe(200);
      expect(rpc).toHaveBeenCalledWith("find_customer_telegram_by_phone", {
        p_vendor_id: VENDOR_ID,
        p_phone: "+6591234567",
      });
      expect(rpc).not.toHaveBeenCalledWith(
        "claim_customer_by_notify_ref",
        expect.anything(),
      );
      expect(sendTelegramMessage).toHaveBeenCalledWith(555, "Reward redeemed!");
    });

    it("is a silent 200 (no send) when the phone has no linked telegram_chat_id", async () => {
      rpc.mockResolvedValue({ data: null, error: null });
      const res = await POST(
        makeRequest({
          vendor_id: VENDOR_ID,
          message: "Reward redeemed!",
          phone: "+6598765432",
        }),
      );
      expect(res.status).toBe(200);
      expect(sendTelegramMessage).not.toHaveBeenCalled();
    });
  });
});
