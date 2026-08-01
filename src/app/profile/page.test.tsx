// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { getUser, getOrCreateVendorProfile } = vi.hoisted(() => ({
  getUser: vi.fn(),
  getOrCreateVendorProfile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => getUser() },
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

import ProfilePage from "./page";

describe("ProfilePage", () => {
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
});
