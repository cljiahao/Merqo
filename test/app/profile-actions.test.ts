import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock factories are hoisted above plain `const` declarations, so any
// mock referenced inside a factory must itself come from vi.hoisted.
const { patchVendorProfile, getOrCreateVendorProfile, getUser } = vi.hoisted(
  () => ({
    patchVendorProfile: vi.fn(),
    getOrCreateVendorProfile: vi.fn(),
    getUser: vi.fn(),
  }),
);

vi.mock("@/lib/merqo-vendor-profile", () => ({
  patchVendorProfile,
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
  patchVendorProfile.mockReset();
  getOrCreateVendorProfile.mockReset();
  getUser.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "v1" } } });
  getOrCreateVendorProfile.mockResolvedValue({
    vendor_id: "v1",
    stall_name: "Existing",
    social_links: {},
  });
});

describe("updateStallName", () => {
  it("calls patchVendorProfile with the new name and existing social links unset (name-only save)", async () => {
    patchVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "New Name",
      social_links: {},
    });
    const result = await updateStallName({ name: "New Name" });
    expect(result.success).toBe(true);
    expect(getOrCreateVendorProfile).not.toHaveBeenCalled();
    expect(patchVendorProfile).toHaveBeenCalledWith(expect.anything(), "v1", {
      stallName: "New Name",
    });
  });

  it("returns an error for an invalid name without calling patchVendorProfile", async () => {
    const result = await updateStallName({ name: "" });
    expect(result.success).toBe(false);
    expect(patchVendorProfile).not.toHaveBeenCalled();
  });

  it("returns an error when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateStallName({ name: "New Name" });
    expect(result).toEqual({ success: false, error: "Not signed in" });
    expect(patchVendorProfile).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the RPC throws", async () => {
    patchVendorProfile.mockRejectedValue(new Error("db down"));
    const result = await updateStallName({ name: "New Name" });
    expect(result).toEqual({
      success: false,
      error: "Could not save stall name",
    });
  });
});

describe("updateSocialLinks", () => {
  it("calls patchVendorProfile with parsed links while leaving the stall name unset", async () => {
    patchVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "Existing",
      social_links: { website: "https://example.com" },
    });
    const result = await updateSocialLinks({ website: "https://example.com" });
    expect(result.success).toBe(true);
    expect(getOrCreateVendorProfile).not.toHaveBeenCalled();
    expect(patchVendorProfile).toHaveBeenCalledWith(expect.anything(), "v1", {
      socialLinks: { website: "https://example.com" },
    });
  });

  it("returns an error for an invalid link without calling patchVendorProfile", async () => {
    const result = await updateSocialLinks({ website: "not-a-url" });
    expect(result.success).toBe(false);
    expect(patchVendorProfile).not.toHaveBeenCalled();
  });

  it("returns a friendly error when the RPC throws", async () => {
    patchVendorProfile.mockRejectedValue(new Error("db down"));
    const result = await updateSocialLinks({ website: "https://example.com" });
    expect(result).toEqual({
      success: false,
      error: "Could not save links",
    });
  });

  it("returns an error when not signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateSocialLinks({ website: "https://example.com" });
    expect(result).toEqual({ success: false, error: "Not signed in" });
    expect(patchVendorProfile).not.toHaveBeenCalled();
  });
});
