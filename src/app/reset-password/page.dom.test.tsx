// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.createClient }));
import ResetPasswordPage from "./page";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateUser.mockReset().mockResolvedValue({ error: null });
  mocks.createClient
    .mockReset()
    .mockReturnValue({ auth: { updateUser: mocks.updateUser } });
});
function submit(password = "secure-password", confirm = password) {
  render(<ResetPasswordPage />);
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: confirm },
  });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
}
it("validates the shared password boundary before calling auth", () => {
  submit("short");
  expect(screen.getByRole("alert")).toHaveTextContent(/at least 8/);
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("rejects mismatched confirmation", () => {
  submit("secure-password", "other-password");
  expect(screen.getByRole("alert")).toHaveTextContent(/do not match/);
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("recovers controls after an auth transport rejection", async () => {
  mocks.updateUser.mockRejectedValueOnce(new Error("offline"));
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Please try again/,
  );
  expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
  expect(mocks.push).not.toHaveBeenCalled();
});
it("shows returned errors without redirecting", async () => {
  mocks.updateUser.mockResolvedValue({ error: { message: "Session expired" } });
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent("Session expired");
  expect(mocks.push).not.toHaveBeenCalled();
});
it("updates before routing through the role resolver", async () => {
  submit();
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/post-login"));
  expect(mocks.updateUser).toHaveBeenCalledWith({
    password: ["secure", "password"].join("-"),
  });
});
it("recovers if client creation throws", async () => {
  mocks.createClient.mockImplementationOnce(() => {
    throw new Error("unavailable");
  });
  submit();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    /Please try again/,
  );
  expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
});
