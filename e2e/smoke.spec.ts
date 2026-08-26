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
test("landing renders with a Sign in action", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: /Simple tools to run your small business/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Sign in" }).first(),
  ).toBeVisible();
  // the interactive kit stacker is the centerpiece
  await expect(
    page.getByRole("button", { name: "Stack all" }).first(),
  ).toBeVisible();
});

// The vendor dashboard requires a session — signed-out visitors are bounced to
// /login by the proxy guard.
test("dashboard redirects a signed-out visitor to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

// Authed areas need a seeded merqo_team user + a live local Supabase instance.
// Gated behind MERQO_E2E_AUTH=1 — CI's e2e job boots a real local Supabase,
// seeds the fixtures below, and sets this flag; a plain `pnpm dev` run has
// neither, so this whole block skips and the public smoke above still passes.
test.describe("authed areas", () => {
  // Intentional, conditional skip with a documented reason string (see the
  // comment block above) — not a forgotten/disabled test.
  test.skip(
    process.env.MERQO_E2E_AUTH !== "1",
    "needs seeded auth (set MERQO_E2E_AUTH=1)",
  );

  // Fixture identities — CI seeds these via the GoTrue admin API + PostgREST
  // (see the e2e job in ci.yml). Overridable so a local run can point at
  // differently-named fixtures without editing this file.
  const TEAM_EMAIL = process.env.MERQO_E2E_TEAM_EMAIL ?? "e2e-team@merqo.test";
  // Fixture default for a throwaway local Supabase test account, not a real credential.
  const TEAM_PASSWORD =
    // eslint-disable-next-line sonarjs/no-hardcoded-passwords
    process.env.MERQO_E2E_TEAM_PASSWORD ?? "e2e-test-pass-123";
  const ADDABLE_EMAIL =
    process.env.MERQO_E2E_ADDABLE_EMAIL ?? "e2e-addable@merqo.test";
  // A product row CI seeds so the grant/revoke test has a kit to pick from
  // without depending on the real product catalog.
  const TEST_KIT_NAME = process.env.MERQO_E2E_TEST_KIT_NAME ?? "E2E Test Kit";
  const TEST_KIT_SLUG = process.env.MERQO_E2E_TEST_KIT_SLUG ?? "e2e-testkit";

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@business.sg").fill(TEAM_EMAIL);
    await page.getByPlaceholder("••••••••").fill(TEAM_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("admin overview renders", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("admin vendors page renders a grant control", async ({ page }) => {
    await page.goto("/admin/vendors");
    await expect(
      page.getByRole("heading", { name: "Grant a kit" }),
    ).toBeVisible();
  });

  test("admin products page renders", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(
      page.getByRole("heading", { name: "Products", exact: true }),
    ).toBeVisible();
  });

  test("admin team page renders the member add form", async ({ page }) => {
    await page.goto("/admin/team");
    await expect(
      page.getByRole("heading", { name: "Team", exact: true }),
    ).toBeVisible();
  });

  test("admin activity page renders the audit trail", async ({ page }) => {
    await page.goto("/admin/activity");
    await expect(
      page.getByRole("heading", { name: "Activity", exact: true }),
    ).toBeVisible();
  });

  test("grants and revokes a kit for a vendor", async ({ page }) => {
    const vendorEmail = `e2e-vendor-${test.info().workerIndex}-${Date.now()}@merqo.test`;
    await page.goto("/admin/vendors");

    const grantForm = page.locator("form").filter({
      has: page.getByPlaceholder("vendor@business.sg"),
    });
    await grantForm.getByPlaceholder("vendor@business.sg").fill(vendorEmail);
    await grantForm.getByLabel("Kit").click();
    await page.getByRole("option", { name: TEST_KIT_NAME }).click();
    await grantForm.getByRole("button", { name: "Grant access" }).click();

    const revokeButton = page.getByRole("button", {
      name: `Revoke ${TEST_KIT_SLUG} from ${vendorEmail}`,
    });
    await expect(revokeButton).toBeVisible();

    await revokeButton.click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Revoke" })
      .click();
    await expect(
      page
        .locator("main")
        .getByRole("listitem")
        .filter({ hasText: vendorEmail }),
    ).toHaveCount(0);

    // Round-trips the whole audit pipeline against the real local Supabase
    // instance (migration + grants + recordAudit + listAdminAuditEntries),
    // not just the mocked unit coverage.
    await page.goto("/admin/activity");
    await expect(page.getByText(vendorEmail).first()).toBeVisible();
  });

  test("adds and removes a team member", async ({ page }) => {
    await page.goto("/admin/team");
    const memberRow = page
      .locator("main")
      .getByRole("listitem")
      .filter({ hasText: ADDABLE_EMAIL });
    await expect(memberRow).toHaveCount(0);

    await page.getByPlaceholder("person@merqo.sg").fill(ADDABLE_EMAIL);
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(memberRow).toBeVisible();

    const removeButton = page.getByRole("button", {
      name: `Remove ${ADDABLE_EMAIL} from the team`,
    });
    await removeButton.click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(memberRow).toHaveCount(0);
  });
});
