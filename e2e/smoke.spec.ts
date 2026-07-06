import { test, expect } from "@playwright/test";

// Public smoke: the app boots and the login page renders without any
// Supabase provisioning. Runnable with only `pnpm dev` + `playwright install`.
test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Continue with Google/ }),
  ).toBeVisible();
  await expect(page.getByPlaceholder("you@business.sg")).toBeVisible();
});

// The landing renders and funnels to the dashboard.
test("landing renders with a Log in action", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Simple tools to run your small business/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();
});

// Authed areas need seeded users + a live Supabase project. Gated behind
// MERQO_E2E_AUTH=1 (set once storage-state auth for a seeded merqo_team user and
// a seeded vendor is wired). Skipped otherwise so CI stays green pre-provisioning.
test.describe("authed areas", () => {
  test.skip(
    process.env.MERQO_E2E_AUTH !== "1",
    "needs seeded auth (set MERQO_E2E_AUTH=1)",
  );

  test("team overview renders product cards", async ({ page }) => {
    await page.goto("/team");
    await expect(
      page.getByRole("heading", { name: /Team Overview/ }),
    ).toBeVisible();
  });

  test("vendor catalog renders with a join-waitlist control", async ({
    page,
  }) => {
    await page.goto("/products");
    await expect(
      page.getByRole("heading", { name: "Your Merqo products" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Join waitlist" }).first(),
    ).toBeVisible();
  });
});
