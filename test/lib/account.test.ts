import { describe, it, expect } from "vitest";
import { getAvatarUrl, getDisplayName } from "@/lib/account";

describe("getAvatarUrl", () => {
  it("returns the avatar_url string when present", () => {
    expect(
      getAvatarUrl({ user_metadata: { avatar_url: "https://x/pic.jpg" } }),
    ).toBe("https://x/pic.jpg");
  });

  it("returns null when avatar_url is absent", () => {
    expect(getAvatarUrl({ user_metadata: {} })).toBeNull();
  });

  it("returns null when avatar_url is not a string", () => {
    expect(getAvatarUrl({ user_metadata: { avatar_url: 42 } })).toBeNull();
  });

  it("returns null for a null/undefined user", () => {
    expect(getAvatarUrl(null)).toBeNull();
    expect(getAvatarUrl(undefined)).toBeNull();
  });
});

describe("getDisplayName", () => {
  it("returns the trimmed full_name when present", () => {
    expect(
      getDisplayName({ user_metadata: { full_name: "  Alice Tan  " } }),
    ).toBe("Alice Tan");
  });

  it("returns null when full_name is blank or whitespace-only", () => {
    expect(getDisplayName({ user_metadata: { full_name: "   " } })).toBeNull();
  });

  it("returns null when full_name is absent", () => {
    expect(getDisplayName({ user_metadata: {} })).toBeNull();
  });

  it("returns null for a null/undefined user", () => {
    expect(getDisplayName(null)).toBeNull();
    expect(getDisplayName(undefined)).toBeNull();
  });
});
