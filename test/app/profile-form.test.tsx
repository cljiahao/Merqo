// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/app/profile/actions", () => ({
  updateDisplayNameAction: vi.fn(),
}));

import { updateDisplayNameAction } from "@/app/profile/actions";
import { ProfileForm } from "@/app/profile/profile-form";

describe("ProfileForm", () => {
  it("renders the image avatar when avatarUrl is provided", () => {
    render(
      <ProfileForm
        email="vendor@example.com"
        avatarUrl="https://lh3.googleusercontent.com/a/pic.jpg"
        displayName={null}
      />,
    );
    expect(screen.getByAltText("Profile picture")).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/pic.jpg",
    );
  });

  it("falls back to initials when avatarUrl is absent", () => {
    render(
      <ProfileForm
        email="vendor@example.com"
        avatarUrl={null}
        displayName={null}
      />,
    );
    expect(screen.queryByAltText("Profile picture")).not.toBeInTheDocument();
    expect(screen.getByText("V")).toBeInTheDocument();
  });

  it("pre-fills the display name input", () => {
    render(
      <ProfileForm
        email="vendor@example.com"
        avatarUrl={null}
        displayName="Alice Tan"
      />,
    );
    expect(screen.getByLabelText("Display name")).toHaveValue("Alice Tan");
  });

  it("submits the trimmed name and shows a success toast on success", async () => {
    vi.mocked(updateDisplayNameAction).mockResolvedValue({ success: true });
    render(
      <ProfileForm
        email="vendor@example.com"
        avatarUrl={null}
        displayName={null}
      />,
    );
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Bob" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateDisplayNameAction).toHaveBeenCalled());
  });

  it("shows the error message when the action fails", async () => {
    vi.mocked(updateDisplayNameAction).mockResolvedValue({
      success: false,
      error: "Enter a name (1-80 characters).",
    });
    render(
      <ProfileForm
        email="vendor@example.com"
        avatarUrl={null}
        displayName={null}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    await waitFor(() => expect(updateDisplayNameAction).toHaveBeenCalled());
  });
});
