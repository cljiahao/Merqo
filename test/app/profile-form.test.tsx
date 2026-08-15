// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateStallName = vi.fn();
const updateSocialLinks = vi.fn();
const updateUser = vi.fn();
const refresh = vi.fn();

vi.mock("@/app/profile/actions", () => ({
  updateStallName: (...args: unknown[]) => updateStallName(...args),
  updateSocialLinks: (...args: unknown[]) => updateSocialLinks(...args),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { updateUser: (...a: unknown[]) => updateUser(...a) },
  }),
}));

import { ProfileForm } from "@/app/profile/profile-form";

const baseProps = {
  stallName: "Kopi & Co",
  displayName: "",
  email: "vendor@example.com",
  vendorId: "v1",
  avatarUrl: null,
  socialLinks: {},
};

beforeEach(() => {
  updateStallName.mockReset();
  updateSocialLinks.mockReset();
  updateUser.mockReset().mockResolvedValue({ error: null });
  refresh.mockReset();
});

describe("ProfileForm — stall name", () => {
  it("saves a changed stall name via the server action", async () => {
    updateStallName.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ProfileForm {...baseProps} />);

    const input = screen.getByLabelText("Stall name");
    await user.clear(input);
    await user.type(input, "New Name");
    await user.click(screen.getByRole("button", { name: /save stall name/i }));

    expect(updateStallName).toHaveBeenCalledWith({ name: "New Name" });
  });

  it("disables the save button when the name hasn't changed", () => {
    render(<ProfileForm {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /save stall name/i }),
    ).toBeDisabled();
  });
});

describe("ProfileForm — display name", () => {
  it("pre-fills the display name input", () => {
    render(<ProfileForm {...baseProps} displayName="Alice Tan" />);
    expect(screen.getByLabelText("Display name")).toHaveValue("Alice Tan");
  });

  it("saves a changed display name via the browser auth client", async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...baseProps} />);

    await user.type(screen.getByLabelText("Display name"), "Bob");
    await user.click(
      screen.getByRole("button", { name: /save display name/i }),
    );

    expect(updateUser).toHaveBeenCalledWith({
      data: { display_name: "Bob" },
    });
  });
});

describe("ProfileForm — change password", () => {
  it("rejects a mismatched password confirmation without calling the auth client", async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...baseProps} />);

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "different1",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password and clears both fields on success", async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...baseProps} />);

    await user.type(screen.getByLabelText("New password"), "password123");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "password123",
    );
    await user.click(screen.getByRole("button", { name: /update password/i }));

    // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- test fixture literal, not a real credential.
    expect(updateUser).toHaveBeenCalledWith({ password: "password123" });
  });
});

describe("ProfileForm — social links", () => {
  it("rejects a non-http website before calling the action", async () => {
    const user = userEvent.setup();
    render(<ProfileForm {...baseProps} />);

    await user.type(screen.getByLabelText(/website/i), "not-a-url");
    await user.click(screen.getByRole("button", { name: /save links/i }));

    expect(screen.getByText(/must be an http\(s\) link/i)).toBeInTheDocument();
    expect(updateSocialLinks).not.toHaveBeenCalled();
  });

  it("saves valid links through the server action", async () => {
    updateSocialLinks.mockResolvedValue({ success: true });
    const user = userEvent.setup();
    render(<ProfileForm {...baseProps} />);

    await user.type(
      screen.getByLabelText(/instagram/i),
      "https://instagram.com/kopi",
    );
    await user.click(screen.getByRole("button", { name: /save links/i }));

    expect(updateSocialLinks).toHaveBeenCalledWith({
      instagram: "https://instagram.com/kopi",
    });
  });
});
