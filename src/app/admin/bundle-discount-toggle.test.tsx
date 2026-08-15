// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

const { setBundleDiscountEnabledMock } = vi.hoisted(() => ({
  setBundleDiscountEnabledMock: vi.fn(),
}));
vi.mock("./actions", () => ({
  setBundleDiscountEnabledAction: setBundleDiscountEnabledMock,
}));

const { toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { success: toastSuccessMock, error: toastErrorMock },
}));

import { BundleDiscountToggle } from "./bundle-discount-toggle";

describe("BundleDiscountToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the off state and switch unchecked", () => {
    render(<BundleDiscountToggle enabled={false} />);
    expect(screen.getByText(/pay full price per kit/i)).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("shows the on state and switch checked", () => {
    render(<BundleDiscountToggle enabled={true} />);
    expect(screen.getByText(/15\/25\/30% off/i)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("calls the action with the flipped value and toasts success", async () => {
    setBundleDiscountEnabledMock.mockResolvedValue({ success: true });
    render(<BundleDiscountToggle enabled={false} />);

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(setBundleDiscountEnabledMock).toHaveBeenCalledWith(true),
    );
    expect(toastSuccessMock).toHaveBeenCalled();
  });

  it("toasts the action's error message on failure", async () => {
    setBundleDiscountEnabledMock.mockResolvedValue({
      success: false,
      error: "Could not update setting",
    });
    render(<BundleDiscountToggle enabled={false} />);

    fireEvent.click(screen.getByRole("switch"));

    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Could not update setting"),
    );
  });

  it("disables the switch while pending", async () => {
    let resolve: (v: { success: true }) => void = () => {};
    setBundleDiscountEnabledMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<BundleDiscountToggle enabled={false} />);

    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toBeDisabled();

    resolve({ success: true });
    await waitFor(() => expect(screen.getByRole("switch")).not.toBeDisabled());
  });
});
