import { describe, it, expect, vi } from "vitest";
import {
  getOrCreateVendorProfile,
  patchVendorProfile,
} from "@/lib/merqo-vendor-profile";

function makeMockClient(rpcResult: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { client: { rpc } as never, rpc };
}

describe("getOrCreateVendorProfile", () => {
  it("calls .rpc('get_or_create_vendor_profile', ...) with the vendor id and default name", async () => {
    const row = {
      vendor_id: "v1",
      stall_name: "Kopi & Co",
      social_links: {},
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const { client, rpc } = makeMockClient({ data: row, error: null });

    const result = await getOrCreateVendorProfile(client, "v1", "Kopi & Co");

    expect(rpc).toHaveBeenCalledWith("get_or_create_vendor_profile", {
      p_vendor_id: "v1",
      p_default_stall_name: "Kopi & Co",
    });
    expect(result).toEqual(row);
  });

  it("throws with the Postgres error message on failure", async () => {
    const { client } = makeMockClient({
      data: null,
      error: { message: "connection refused" },
    });
    await expect(getOrCreateVendorProfile(client, "v1", null)).rejects.toThrow(
      "get_or_create_vendor_profile failed: connection refused",
    );
  });
});

describe("patchVendorProfile", () => {
  it("sends only the changed name", async () => {
    const { client, rpc } = makeMockClient({
      data: {
        stall_name: "New",
        social_links: { website: "https://existing.test" },
      },
      error: null,
    });
    await patchVendorProfile(client, "v1", { stallName: "New" });
    expect(rpc).toHaveBeenCalledWith("patch_vendor_profile", {
      p_vendor_id: "v1",
      p_stall_name: "New",
      p_social_links: null,
    });
  });
  it("allows clearing links without changing the name", async () => {
    const { client, rpc } = makeMockClient({
      data: { stall_name: "Existing", social_links: {} },
      error: null,
    });
    await patchVendorProfile(client, "v1", { socialLinks: {} });
    expect(rpc).toHaveBeenCalledWith("patch_vendor_profile", {
      p_vendor_id: "v1",
      p_stall_name: null,
      p_social_links: {},
    });
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "offline" } },
  ])("rejects an unsuccessful patch", async (result) => {
    const { client } = makeMockClient(result);
    await expect(
      patchVendorProfile(client, "v1", { stallName: "New" }),
    ).rejects.toThrow("patch_vendor_profile failed");
  });
});
