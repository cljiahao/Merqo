// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { ConfirmAdminAction } from "./confirm-admin-action";
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
const props = {
  trigger: <button>Open confirmation</button>,
  title: "Confirm removal?",
  description: "This removes access.",
  successMessage: "Removed",
  confirmLabel: "Confirm",
  pendingLabel: "Removing…",
};
it("keeps returned errors open for retry and closes after success", async () => {
  const action = vi
    .fn()
    .mockResolvedValueOnce({ success: false, error: "Permission changed" })
    .mockResolvedValueOnce({ success: true });
  const user = userEvent.setup();
  render(<ConfirmAdminAction {...props} action={action} />);
  await user.click(screen.getByRole("button", { name: "Open confirmation" }));
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  expect(toast.error).toHaveBeenCalledWith("Permission changed");
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  expect(toast.success).toHaveBeenCalledWith("Removed");
  await waitFor(() =>
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
  );
});
it("recovers from a rejected operation without losing the confirmation", async () => {
  const action = vi
    .fn()
    .mockRejectedValueOnce(new Error("Transport failed"))
    .mockResolvedValueOnce({ success: true });
  const user = userEvent.setup();
  render(<ConfirmAdminAction {...props} action={action} />);
  await user.click(screen.getByRole("button", { name: "Open confirmation" }));
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  expect(toast.error).toHaveBeenCalledWith(
    "Couldn't complete this action. Please try again.",
  );
  expect(screen.getByRole("button", { name: "Confirm" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  expect(action).toHaveBeenCalledTimes(2);
});
it("disables confirmation and cancellation while a save is pending", async () => {
  let resolve!: (result: { success: true }) => void;
  const action = vi.fn(
    () =>
      new Promise<{ success: true }>((done) => {
        resolve = done;
      }),
  );
  const user = userEvent.setup();
  render(<ConfirmAdminAction {...props} action={action} />);
  await user.click(screen.getByRole("button", { name: "Open confirmation" }));
  await user.click(screen.getByRole("button", { name: "Confirm" }));
  expect(screen.getByRole("button", { name: "Removing…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(action).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ success: true }));
});
