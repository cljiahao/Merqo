// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountMenu } from "./account-menu";
import type { ActionResult } from "@/lib/action-result";

const mocks = vi.hoisted(() => ({
  signOutAction: vi.fn(async () => {}),
  submitFeedbackAction: vi.fn<() => Promise<ActionResult>>(async () => ({
    success: true,
  })),
  submitSupportMessageAction: vi.fn<() => Promise<ActionResult>>(async () => ({
    success: true,
  })),
  toastError: vi.fn(),
}));
const toastErrorMock = mocks.toastError;

vi.mock("@/app/actions/auth", () => ({
  signOutAction: mocks.signOutAction,
}));
vi.mock("@/app/actions/feedback", () => ({
  submitFeedbackAction: mocks.submitFeedbackAction,
}));
vi.mock("@/app/actions/support", () => ({
  submitSupportMessageAction: mocks.submitSupportMessageAction,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.signOutAction.mockResolvedValue(undefined);
  mocks.submitFeedbackAction.mockResolvedValue({ success: true });
  mocks.submitSupportMessageAction.mockResolvedValue({ success: true });
});

describe("AccountMenu", () => {
  it("shows the signed-in email as the trigger subtitle, not a placeholder", () => {
    render(<AccountMenu email="team@merqo.io" avatarUrl={null} />);
    expect(screen.getByText("team@merqo.io")).toBeInTheDocument();
  });

  it("falls back to the • initials avatar when there is no email", () => {
    render(<AccountMenu email={null} avatarUrl={null} />);
    expect(screen.getByText("•")).toBeInTheDocument();
  });

  it("renders an image avatar when avatarUrl is provided", () => {
    const { container } = render(
      <AccountMenu
        email="vendor@business.sg"
        avatarUrl="https://lh3.googleusercontent.com/a/pic.jpg"
      />,
    );
    // @merqo/ui's AccountMenu renders the avatar with alt="" (decorative —
    // the trigger's own aria-label already announces "Account menu"), which
    // strips it from the accessibility tree, so query it directly rather
    // than by role.
    const img = container.querySelector("img");
    expect(img).toHaveAttribute(
      "src",
      "https://lh3.googleusercontent.com/a/pic.jpg",
    );
  });

  it("the Profile link points at /dashboard/profile, which redirects to Merqo's real /profile route", async () => {
    const user = userEvent.setup();
    render(<AccountMenu email="team@merqo.io" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(screen.getByRole("menuitem", { name: "Profile" })).toHaveAttribute(
      "href",
      "/dashboard/profile",
    );
  });

  it("account menu has Profile, Get help, Feedback, Theme (in that order), then Sign out — no Plan item", async () => {
    const user = userEvent.setup();
    render(<AccountMenu email="team@merqo.io" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.map((item) => item.textContent)).toEqual([
      "Profile",
      "Get help",
      "Feedback",
      "Theme · System",
      "Sign out",
    ]);
  });

  it("renders the optional switch link as an extra menu item", async () => {
    const user = userEvent.setup();
    render(
      <AccountMenu
        email="vendor@business.sg"
        avatarUrl={null}
        switchTo={{ href: "/admin", label: "Go to admin" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(
      screen.getByRole("menuitem", { name: "Go to admin" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("omits the switch link when switchTo is not passed", async () => {
    const user = userEvent.setup();
    render(<AccountMenu email="vendor@business.sg" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));

    expect(
      screen.queryByRole("menuitem", { name: "Go to admin" }),
    ).not.toBeInTheDocument();
  });

  it("opening Feedback and submitting calls submitFeedbackAction with the picked NPS score", async () => {
    const user = userEvent.setup();
    render(<AccountMenu email="vendor@business.sg" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Feedback" }));

    await user.click(screen.getByRole("radio", { name: "9" }));
    await user.type(screen.getByLabelText("Message"), "Love the board");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(mocks.submitFeedbackAction).toHaveBeenCalledWith({
      nps: 9,
      message: "Love the board",
    });
  });

  it("a failed feedback submit surfaces an inline error, not a silent failure", async () => {
    mocks.submitFeedbackAction.mockResolvedValue({
      success: false,
      error: "Thanks — you've already sent feedback.",
    });
    const user = userEvent.setup();
    render(<AccountMenu email="vendor@business.sg" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Feedback" }));

    await user.click(screen.getByRole("radio", { name: "5" }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(
      await screen.findByText("Thanks — you've already sent feedback."),
    ).toBeInTheDocument();
  });

  it("opening Get help and submitting a category not in Merqo's own list falls back to 'other'", async () => {
    const user = userEvent.setup();
    render(<AccountMenu email="vendor@business.sg" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Get help" }));

    await user.click(screen.getByRole("radio", { name: "Billing" }));
    await user.type(screen.getByLabelText("Message"), "Can't view invoice");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(mocks.submitSupportMessageAction).toHaveBeenCalledWith({
      category: "billing",
      body: "Can't view invoice",
    });
  });

  it("signing out calls signOutAction", async () => {
    const user = userEvent.setup();
    render(<AccountMenu email="team@merqo.io" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    expect(mocks.signOutAction).toHaveBeenCalled();
  });

  it("signing out swallows the redirect() control-flow error instead of toasting it", async () => {
    const redirectError = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;push;/login;307;",
    });
    mocks.signOutAction.mockRejectedValue(redirectError);
    const user = userEvent.setup();
    render(<AccountMenu email="team@merqo.io" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => expect(mocks.signOutAction).toHaveBeenCalled());
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("a genuine sign-out failure still surfaces an error toast", async () => {
    mocks.signOutAction.mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    render(<AccountMenu email="team@merqo.io" avatarUrl={null} />);
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Network error"),
    );
  });
});
