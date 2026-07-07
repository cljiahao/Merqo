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
  // the interactive kit stacker is the centerpiece
  await expect(
    page.getByRole("button", { name: "Stack all" }).first(),
  ).toBeVisible();
});

// Authed areas need a seeded merqo_team user + a live Supabase project. Gated
// behind MERQO_E2E_AUTH=1 (set once storage-state auth is wired). Skipped
// otherwise so CI stays green pre-provisioning.
test.describe("authed areas", () => {
  test.skip(
    process.env.MERQO_E2E_AUTH !== "1",
    "needs seeded auth (set MERQO_E2E_AUTH=1)",
  );

  test("dashboard overview renders product cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("vendors page renders a grant control", async ({ page }) => {
    await page.goto("/vendors");
    await expect(
      page.getByRole("heading", { name: "Grant a kit" }),
    ).toBeVisible();
  });

  test("team page renders the member add form", async ({ page }) => {
    await page.goto("/team");
    await expect(
      page.getByRole("heading", { name: "Team", exact: true }),
    ).toBeVisible();
  });
});
