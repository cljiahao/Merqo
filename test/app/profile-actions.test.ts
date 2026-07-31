import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted above plain `const` declarations, so any
// mock referenced inside a factory must itself come from vi.hoisted.
const { upsertVendorProfile, getOrCreateVendorProfile, getUser } = vi.hoisted(
  () => ({
    upsertVendorProfile: vi.fn(),
    getOrCreateVendorProfile: vi.fn(),
    getUser: vi.fn(),
  }),
);

vi.mock("@/lib/merqo-vendor-profile", () => ({
  upsertVendorProfile,
  getOrCreateVendorProfile,
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => getUser() },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateStallName, updateSocialLinks } from "@/app/profile/actions";

beforeEach(() => {
  upsertVendorProfile.mockReset();
  getOrCreateVendorProfile.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "v1" } } });
  // Both actions read the current profile first (see actions.ts) before
  // upserting the one changed field.
  getOrCreateVendorProfile.mockResolvedValue({
    vendor_id: "v1",
    stall_name: "Existing",
    social_links: {},
  });
});

describe("updateStallName", () => {
  it("calls upsertVendorProfile with the new name and existing social links unset (name-only save)", async () => {
    upsertVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "New Name",
      social_links: {},
    });
    const result = await updateStallName({ name: "New Name" });
    expect(result.success).toBe(true);
    expect(upsertVendorProfile).toHaveBeenCalledWith(
      expect.anything(),
      "v1",
      "New Name",
      {},
    );
  });

  it("returns an error for an invalid name without calling upsertVendorProfile", async () => {
    const result = await updateStallName({ name: "" });
    expect(result.success).toBe(false);
    expect(upsertVendorProfile).not.toHaveBeenCalled();
  });

  it("returns an error when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateStallName({ name: "New Name" });
    expect(result).toEqual({ success: false, error: "Not signed in" });
    expect(upsertVendorProfile).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the RPC throws", async () => {
    upsertVendorProfile.mockRejectedValue(new Error("db down"));
    const result = await updateStallName({ name: "New Name" });
    expect(result).toEqual({
      success: false,
      error: "Could not save stall name",
    });
  });
});

describe("updateSocialLinks", () => {
  it("calls upsertVendorProfile with the parsed links and the existing stall name", async () => {
    upsertVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "Existing",
      social_links: { website: "https://example.com" },
    });
    const result = await updateSocialLinks({ website: "https://example.com" });
    expect(result.success).toBe(true);
    expect(upsertVendorProfile).toHaveBeenCalledWith(
      expect.anything(),
      "v1",
      "Existing",
      { website: "https://example.com" },
    );
  });

  it("returns an error for an invalid link without calling upsertVendorProfile", async () => {
    const result = await updateSocialLinks({ website: "not-a-url" });
    expect(result.success).toBe(false);
    expect(upsertVendorProfile).not.toHaveBeenCalled();
  });
});
