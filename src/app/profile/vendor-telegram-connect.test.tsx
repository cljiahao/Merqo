// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const {
  mintVendorTelegramConnectToken,
  disconnectVendorTelegram,
  refresh,
  toastError,
} = vi.hoisted(() => ({
  mintVendorTelegramConnectToken: vi.fn(),
  disconnectVendorTelegram: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("./vendor-telegram-actions", () => ({
  mintVendorTelegramConnectToken,
  disconnectVendorTelegram,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { VendorTelegramConnect } from "./vendor-telegram-connect";

describe("VendorTelegramConnect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("disconnected: connecting mints a token and renders the deep link", async () => {
    mintVendorTelegramConnectToken.mockResolvedValue({
      success: true,
      deepLink: "https://t.me/MerqoNotifyBot?start=abc123",
      qrSvgMarkup: "<svg data-testid='qr' />",
    });
    render(<VendorTelegramConnect connected={false} />);

    fireEvent.click(screen.getByRole("button", { name: /connect telegram/i }));

    expect(await screen.findByTestId("qr")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /t\.me\/MerqoNotifyBot/ }),
    ).toHaveAttribute("href", "https://t.me/MerqoNotifyBot?start=abc123");
  });

  it("disconnected: a mint failure toasts the error, renders no link", async () => {
    mintVendorTelegramConnectToken.mockResolvedValue({
      success: false,
      error: "Telegram isn't set up yet",
    });
    render(<VendorTelegramConnect connected={false} />);

    fireEvent.click(screen.getByRole("button", { name: /connect telegram/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Telegram isn't set up yet");
    });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("connected: disconnecting calls the action and refreshes on success", async () => {
    disconnectVendorTelegram.mockResolvedValue({ success: true });
    render(<VendorTelegramConnect connected={true} />);

    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));

    await waitFor(() => {
      expect(disconnectVendorTelegram).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalled();
    });
  });

  it("connected: a disconnect failure toasts the error without refreshing", async () => {
    disconnectVendorTelegram.mockResolvedValue({
      success: false,
      error: "Could not disconnect Telegram",
    });
    render(<VendorTelegramConnect connected={true} />);

    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Could not disconnect Telegram");
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
