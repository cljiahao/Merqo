import { describe, it, expect } from "vitest";
import {
  profileNameSchema,
  displayNameSchema,
  passwordChangeSchema,
  socialLinksSchema,
} from "@/lib/schemas";

describe("profileNameSchema", () => {
  it("accepts a valid stall name", () => {
    expect(profileNameSchema.safeParse({ name: "Kopi & Co" }).success).toBe(
      true,
    );
  });

  it("rejects an empty name", () => {
    expect(profileNameSchema.safeParse({ name: "" }).success).toBe(false);
  });

  it("rejects a name over 100 chars", () => {
    expect(profileNameSchema.safeParse({ name: "x".repeat(101) }).success).toBe(
      false,
    );
  });
});

describe("displayNameSchema", () => {
  it("accepts a personal name", () => {
    expect(displayNameSchema.safeParse({ displayName: "Aisha" }).success).toBe(
      true,
    );
  });

  it("accepts an empty string (clears the name)", () => {
    expect(displayNameSchema.safeParse({ displayName: "" }).success).toBe(true);
  });

  it("rejects a name over 60 chars", () => {
    expect(
      displayNameSchema.safeParse({ displayName: "x".repeat(61) }).success,
    ).toBe(false);
  });
});

describe("passwordChangeSchema", () => {
  it("accepts matching passwords of at least 8 chars", () => {
    expect(
      passwordChangeSchema.safeParse({
        password: "hunter22",
        confirm: "hunter22",
      }).success,
    ).toBe(true);
  });

  it("rejects a password shorter than 8", () => {
    expect(
      passwordChangeSchema.safeParse({ password: "short", confirm: "short" })
        .success,
    ).toBe(false);
  });

  it("rejects when confirm does not match", () => {
    const res = passwordChangeSchema.safeParse({
      password: "hunter22",
      confirm: "hunter23",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.path).toEqual(["confirm"]);
    }
  });
});

describe("socialLinksSchema", () => {
  it("accepts a fully-populated set of http(s) links", () => {
    const parsed = socialLinksSchema.safeParse({
      website: "https://example.com",
      instagram: "https://instagram.com/example",
      facebook: "https://facebook.com/example",
      tiktok: "https://tiktok.com/@example",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty object (nothing set)", () => {
    expect(socialLinksSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a bare domain with no protocol", () => {
    expect(
      socialLinksSchema.safeParse({ website: "example.com" }).success,
    ).toBe(false);
  });

  it("rejects a javascript: URL", () => {
    expect(
      socialLinksSchema.safeParse({ instagram: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
});
