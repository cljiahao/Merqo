import { describe, it, expect, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

import DashboardProfileRedirect from "./page";

describe("DashboardProfileRedirect", () => {
  it("redirects /dashboard/profile to /profile", () => {
    DashboardProfileRedirect();
    expect(redirect).toHaveBeenCalledWith("/profile");
  });
});
