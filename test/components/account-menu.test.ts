import { describe, it, expect } from "vitest";
import { initials } from "@/components/account-menu";

describe("initials", () => {
  it("returns the uppercased first character of an email", () => {
    expect(initials("alice@example.com")).toBe("A");
  });

  it("returns • for null", () => {
    expect(initials(null)).toBe("•");
  });

  it("returns • for undefined", () => {
    expect(initials(undefined)).toBe("•");
  });

  it("returns • for an empty string", () => {
    expect(initials("")).toBe("•");
  });
});
