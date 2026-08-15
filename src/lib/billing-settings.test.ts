import { describe, it, expect, vi, beforeEach } from "vitest";

const { fromMock, createServiceClientMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createServiceClientMock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: createServiceClientMock,
}));

import {
  getBillingSettings,
  DEFAULT_BILLING_SETTINGS,
} from "./billing-settings";

function clientReturning(data: unknown, error: unknown = null) {
  fromMock.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data, error }),
      }),
    }),
  });
}

describe("getBillingSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceClientMock.mockResolvedValue({ from: fromMock });
  });

  it("returns the live row's value", async () => {
    clientReturning({ bundle_discount_enabled: true });
    expect(await getBillingSettings()).toEqual({
      bundle_discount_enabled: true,
    });
  });

  it("falls back to the default on a read error", async () => {
    clientReturning(null, new Error("boom"));
    expect(await getBillingSettings()).toEqual(DEFAULT_BILLING_SETTINGS);
  });

  it("falls back to the default when no row exists", async () => {
    clientReturning(null, null);
    expect(await getBillingSettings()).toEqual(DEFAULT_BILLING_SETTINGS);
  });
});
