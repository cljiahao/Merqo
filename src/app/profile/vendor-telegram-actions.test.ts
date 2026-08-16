import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const getUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => getUser() },
  }),
  createServiceClient: vi.fn(async () => ({ from })),
}));

const generateLinkToken = vi.fn().mockReturnValue("generated-token-abc");
vi.mock("@/lib/telegram", () => ({
  generateLinkToken: () => generateLinkToken(),
}));

const qrSvg = vi.fn().mockResolvedValue("<svg data-testid='qr' />");
vi.mock("@/lib/qr", () => ({
  qrSvg: (text: string) => qrSvg(text),
}));

const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => revalidatePath(...a),
}));

const insert = vi.fn().mockResolvedValue({ data: null, error: null });
const deleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
const from = vi.fn((table: string) => {
  if (table === "telegram_link_tokens") return { insert };
  if (table === "vendor_telegram") return { delete: () => ({ eq: deleteEq }) };
  throw new Error(`unexpected table: ${table}`);
});

import {
  mintVendorTelegramConnectToken,
  disconnectVendorTelegram,
} from "./vendor-telegram-actions";

const ORIGINAL_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

beforeEach(() => {
  process.env.TELEGRAM_BOT_USERNAME = "MerqoNotifyBot";
  getUser.mockResolvedValue({ data: { user: { id: "vendor-1" } } });
  generateLinkToken.mockReturnValue("generated-token-abc");
  qrSvg.mockClear();
  qrSvg.mockResolvedValue("<svg data-testid='qr' />");
  insert.mockClear();
  insert.mockResolvedValue({ data: null, error: null });
  deleteEq.mockClear();
  deleteEq.mockResolvedValue({ data: null, error: null });
  from.mockClear();
  revalidatePath.mockClear();
});

afterEach(() => {
  if (ORIGINAL_BOT_USERNAME === undefined)
    delete process.env.TELEGRAM_BOT_USERNAME;
  else process.env.TELEGRAM_BOT_USERNAME = ORIGINAL_BOT_USERNAME;
});

describe("mintVendorTelegramConnectToken", () => {
  it("fails when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await mintVendorTelegramConnectToken();
    expect(result).toEqual({ success: false, error: "Not signed in" });
    expect(insert).not.toHaveBeenCalled();
  });

  it("fails when TELEGRAM_BOT_USERNAME isn't configured", async () => {
    delete process.env.TELEGRAM_BOT_USERNAME;
    const result = await mintVendorTelegramConnectToken();
    expect(result.success).toBe(false);
    expect(insert).not.toHaveBeenCalled();
  });

  it("mints a kind='vendor' token and returns the deep link + QR markup", async () => {
    const result = await mintVendorTelegramConnectToken();
    expect(result).toEqual({
      success: true,
      deepLink: "https://t.me/MerqoNotifyBot?start=generated-token-abc",
      qrSvgMarkup: "<svg data-testid='qr' />",
    });
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({
      token: "generated-token-abc",
      vendor_id: "vendor-1",
      kit_slug: "merqo",
      kind: "vendor",
    });
    expect(qrSvg).toHaveBeenCalledWith(
      "https://t.me/MerqoNotifyBot?start=generated-token-abc",
    );
  });

  it("fails when the insert errors", async () => {
    insert.mockResolvedValue({ data: null, error: { message: "db down" } });
    const result = await mintVendorTelegramConnectToken();
    expect(result.success).toBe(false);
  });
});

describe("disconnectVendorTelegram", () => {
  it("fails when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await disconnectVendorTelegram();
    expect(result).toEqual({ success: false, error: "Not signed in" });
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("deletes the caller's own vendor_telegram row and revalidates the profile page", async () => {
    const result = await disconnectVendorTelegram();
    expect(result).toEqual({ success: true });
    expect(deleteEq).toHaveBeenCalledWith("vendor_id", "vendor-1");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
  });

  it("fails when the delete errors", async () => {
    deleteEq.mockResolvedValue({ data: null, error: { message: "db down" } });
    const result = await disconnectVendorTelegram();
    expect(result.success).toBe(false);
  });
});
