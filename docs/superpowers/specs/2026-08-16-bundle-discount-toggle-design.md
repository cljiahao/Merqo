# Bundle Discount Toggle — Design

**Date:** 2026-08-16
**Status:** Approved; plan to follow.

## Summary

`docs/business/2026-07-30-cross-kit-pricing-and-billing-plan.md` (revised
2026-08-15) settled on launching the 15/25/30% cross-kit bundle discount
**off by default**, kept as a pre-computed, admin-togglable lever rather
than an always-on default — same "founding price" logic as every other
number in this session's pricing review: no data yet on whether a
discount is actually needed to drive multi-kit attach, so nothing gets
given away pre-emptively.

This spec adds the toggle itself: a single boolean flag, admin-settable
from merqo's own `/admin` overview page (merqo is the one place that
already owns cross-kit vendor identity and is named in the pricing doc as
where this kind of billing config should live). **The toggle does not yet
drive any real pricing computation** — no kit reads it, no checkout path
branches on it, because the bundle-discount computation itself is still
Phase 3-gated (no Stripe integration, no `billing_events`/`pricing_config`
tables exist anywhere in the ecosystem yet). This spec lays down the
flag and its admin UI only, so it's ready to be read once Phase 3 billing
work actually starts — not a redesign at that point, just a new consumer
of an existing flag.

## Guiding decisions

- **Lives in merqo's own schema** (`merqo.billing_settings`), not any
  individual kit's — matches the pricing doc's own placement decision for
  `vendor_kit_status`/`billing_events`/`pricing_config` ("this lives in
  merqo's schema — it's the one place that already owns cross-kit vendor
  identity").
- **Singleton row, same shape as qkit's own `platform_settings` table**
  (`id` pinned to 1, `CHECK (id = 1)`, public-read RLS, no UPDATE policy —
  writes go through the service-role admin action only, gated by
  `requireMerqoTeam()` in app code). Reusing an already-proven pattern
  rather than inventing a new one.
- **Public read, not team-only.** Not secret — a future kit's own
  checkout/plan page will eventually need to read this flag directly to
  decide whether to show bundle pricing to a vendor, the same reasoning
  qkit's `platform_settings`/`pricing` tables already use ("not secret,
  keep it simple").
- **No new billing computation, no new consumer.** This is explicitly a
  standalone flag with no reader yet — the plan does not touch any kit's
  checkout, plan page, or pricing display. Building the actual discount
  math is a separate, larger, Phase-3-gated piece of work.

## What changes

### `supabase/migrations/0017_billing_settings.sql` (new)

```sql
CREATE TABLE merqo.billing_settings (
  id                       INT         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bundle_discount_enabled  BOOLEAN     NOT NULL DEFAULT false,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO merqo.billing_settings (id)
  VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE merqo.billing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_settings_public_select" ON merqo.billing_settings
  FOR SELECT USING (true);

GRANT SELECT ON merqo.billing_settings TO anon;
GRANT SELECT ON merqo.billing_settings TO authenticated;
```

No UPDATE policy for any role — writes go through the service-role
`setBundleDiscountEnabledAction` only.

### `src/lib/billing-settings.ts` (new)

```ts
export interface BillingSettings {
  bundle_discount_enabled: boolean;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  bundle_discount_enabled: false,
};

export async function getBillingSettings(): Promise<BillingSettings> {
  // reads merqo.billing_settings id=1, falls back to DEFAULT_BILLING_SETTINGS
  // if the row can't be read (mirrors qkit's DEFAULT_PRICING fallback shape)
}
```

### `src/app/admin/actions.ts`

Add `setBundleDiscountEnabledAction(enabled: boolean): Promise<ActionResult>`
— `requireMerqoTeam()` gate, service-role write to
`merqo.billing_settings`, `revalidatePath("/admin")`.

### `src/app/admin/bundle-discount-toggle.tsx` (new)

Client component: shadcn `Switch` (added via `pnpm dlx shadcn@latest add
switch` — not yet in `components/ui/`) + `useAsyncAction` + `sonner`
toast, matching `revoke-button.tsx`'s existing pattern in this same
folder. Label: "Cross-kit bundle discount" with a one-line caption
explaining current state ("Off — vendors pay full price per kit" /
"On — 15/25/30% off at 2/3/4 active kits").

### `src/app/admin/page.tsx`

Fetch `getBillingSettings()` in the existing `Promise.all` alongside
`listLiveProducts()`/`listVendorGrants()`/`listOpenSupportMessages()`.
Render `<BundleDiscountToggle enabled={settings.bundle_discount_enabled} />`
in a small new section, placed after the existing stat cards and before
"Products" — a settings-style control, not a metric.

## Testing

- `src/lib/billing-settings.test.ts`: `getBillingSettings()` returns the
  live row's value; falls back to `DEFAULT_BILLING_SETTINGS` on a read
  error.
- `src/app/admin/actions.test.ts` (extend): `setBundleDiscountEnabledAction`
  writes the flag, gated by `requireMerqoTeam()`, surfaces a friendly
  error on a DB failure (matches this file's existing test shape for
  `setBanner`/`setVendorPlan`).
- `src/app/admin/bundle-discount-toggle.dom.test.tsx` (new): renders the
  current state, toggling calls the action with the flipped value, shows
  a pending state, toasts success/failure.
- `supabase/tests/rls.test.sql` (extend): `billing_settings` — RLS
  enabled, public SELECT for anon/authenticated, no UPDATE grant for
  either.

## Self-review

- No placeholders — every file has real, complete code, not a skeleton.
- Scope: the flag + its admin UI only. No kit's checkout/plan/pricing
  code is touched — explicitly out of scope per the pricing doc's own
  Phase 3 gating.
- Internally consistent: mirrors qkit's proven `platform_settings`
  pattern exactly (singleton, public-read, service-role-only write) —
  not a new shape to review from scratch.

## Parent

[specs](README.md)
