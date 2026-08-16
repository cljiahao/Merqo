// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { getUser, getOrCreateVendorProfile, maybeSingle } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOrCreateVendorProfile: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => getUser() },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { updateUser: vi.fn() } }),
}));
vi.mock("@/lib/merqo-vendor-profile", () => ({ getOrCreateVendorProfile }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("./vendor-telegram-actions", () => ({
  mintVendorTelegramConnectToken: vi.fn(),
  disconnectVendorTelegram: vi.fn(),
}));

import ProfilePage from "./page";

describe("ProfilePage", () => {
  beforeEach(() => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("renders the form with the vendor's shared profile and auth-user fields", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "v1",
          email: "vendor@business.sg",
          user_metadata: {
            display_name: "Aisha",
            avatar_url: "https://x/pic.jpg",
          },
        },
      },
    });
    getOrCreateVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "Kopi & Co",
      social_links: { website: "https://kopi.example" },
    });

    render(await ProfilePage());

    expect(screen.getByLabelText("Stall name")).toHaveValue("Kopi & Co");
    expect(screen.getByLabelText("Display name")).toHaveValue("Aisha");
    expect(screen.getByLabelText("Email")).toHaveValue("vendor@business.sg");
  });

  it("renders the vendor Telegram connect section as disconnected when there's no vendor_telegram row", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { id: "v1", email: "vendor@business.sg", user_metadata: {} },
      },
    });
    getOrCreateVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "Kopi & Co",
      social_links: {},
    });
    maybeSingle.mockResolvedValue({ data: null, error: null });

    render(await ProfilePage());

    expect(
      screen.getByRole("button", { name: /connect telegram/i }),
    ).toBeInTheDocument();
  });

  it("renders the vendor Telegram connect section as connected when a vendor_telegram row exists", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { id: "v1", email: "vendor@business.sg", user_metadata: {} },
      },
    });
    getOrCreateVendorProfile.mockResolvedValue({
      vendor_id: "v1",
      stall_name: "Kopi & Co",
      social_links: {},
    });
    maybeSingle.mockResolvedValue({ data: { vendor_id: "v1" }, error: null });

    render(await ProfilePage());

    expect(screen.getByText(/telegram connected/i)).toBeInTheDocument();
  });
});
