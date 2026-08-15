# Bundle Discount Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single admin-togglable flag (`merqo.billing_settings.bundle_discount_enabled`)
and its `/admin` UI, so the cross-kit bundle discount can be flipped on
later without a redeploy. No pricing computation reads this flag yet —
that's separate, Phase 3-gated work.

**Spec:** `docs/superpowers/specs/2026-08-16-bundle-discount-toggle-design.md`

## Global Constraints

- No kit's checkout/plan/pricing display reads this flag in this plan —
  standalone infrastructure only.
- Mirror qkit's `platform_settings` table shape exactly (singleton,
  public-read RLS, no UPDATE policy for any client role).
- TypeScript strict — no `any`.
- Work on a feature branch, never commit directly to `main`.
- Run `pnpm check && pnpm test && pnpm build` before opening the PR.

---

### Task 1: Migration + shared reader

**Files:** Create `supabase/migrations/0017_billing_settings.sql`,
`src/lib/billing-settings.ts`, `src/lib/billing-settings.test.ts`.

- [ ] Write the migration exactly as in the spec's "What changes" section.
- [ ] Apply locally (`/supabase-migrate` skill or `supabase migration up`).
- [ ] Write `getBillingSettings()` + `DEFAULT_BILLING_SETTINGS`, with a
      failing test first (mocked Supabase client: happy path returns the
      row's value, error path falls back to the default).
- [ ] Commit: `feat: add merqo.billing_settings table and reader`.

### Task 2: Admin action

**Files:** Modify `src/app/admin/actions.ts`, `src/app/admin/actions.test.ts`.

- [ ] Failing test first: `setBundleDiscountEnabledAction(true)` writes the
      flag via the service client, gated by `requireMerqoTeam()`, returns
      a friendly error on a DB failure (same shape as this file's existing
      `setBanner` test).
- [ ] Implement `setBundleDiscountEnabledAction`.
- [ ] Commit: `feat: add setBundleDiscountEnabledAction`.

### Task 3: Toggle component + page wiring

**Files:** `pnpm dlx shadcn@latest add switch` (new `src/components/ui/switch.tsx`),
create `src/app/admin/bundle-discount-toggle.tsx` +
`bundle-discount-toggle.dom.test.tsx`, modify `src/app/admin/page.tsx`.

- [ ] Add the shadcn `Switch` component.
- [ ] Failing tests first for `BundleDiscountToggle`: renders current
      state, toggling calls the action with the flipped value, pending
      state, toast success/error (mirror `revoke-button.tsx`'s test
      shape).
- [ ] Implement `BundleDiscountToggle`.
- [ ] Wire `getBillingSettings()` into `page.tsx`'s existing `Promise.all`
      and render the toggle in a new small section, after the stat cards,
      before "Products".
- [ ] Commit: `feat: add bundle discount toggle to the admin overview page`.

### Task 4: RLS coverage + docs

**Files:** `supabase/tests/rls.test.sql`, `src/app/admin/README.md`,
`src/lib/README.md`, `CHANGELOG.md`.

- [ ] Extend the pgTAP suite: RLS enabled, public SELECT for
      anon/authenticated on `billing_settings`, no UPDATE grant for
      either.
- [ ] Update `admin/README.md`'s Contents with a `bundle-discount-toggle.tsx`
      bullet and extend the `page.tsx` bullet to mention it fetches
      billing settings too.
- [ ] Update `lib/README.md` with a `billing-settings.ts` bullet.
- [ ] Add a `CHANGELOG.md` entry.
- [ ] Commit: `docs: document the bundle discount toggle`.

### Task 5: Verification gate + ship

- [ ] `pnpm check && pnpm test && pnpm build`; `supabase test db` for RLS.
- [ ] Push, open PR, poll CI to green, squash-merge.

## Self-Review Notes

- Spec coverage: migration+reader (Task 1), action (Task 2), UI+wiring
  (Task 3), RLS+docs (Task 4). No task builds pricing computation —
  correctly out of scope per the spec.
- No schema/RLS deviation from the proven `platform_settings` shape.
