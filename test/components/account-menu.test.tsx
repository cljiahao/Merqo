// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { initials, AccountMenu } from "@/components/account-menu";

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

describe("AccountMenu", () => {
  it("shows the avatar initial and the full email on the trigger", () => {
    render(<AccountMenu email="vendor@example.com" />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("V");
    expect(trigger).toHaveTextContent("vendor@example.com");
  });

  it("shows only the • avatar and no email text when email is absent", () => {
    render(<AccountMenu email={null} />);
    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(trigger).toHaveTextContent("•");
    expect(screen.queryByText("@")).not.toBeInTheDocument();
  });
});
