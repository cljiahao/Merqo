# migrations

## Purpose

The ordered, append-only SQL schema history for the `merqo` Postgres schema —
the house hub's own tables (team membership, the kit registry, vendor grants)
plus the shared cross-kit tables every kit reads/writes over HTTP or a
same-database RPC (vendor identity, customers, support messages, feedback,
admin audit). Applied in filename order via the Supabase CLI or the
project's `/supabase-migrate` skill; nothing here is ever edited after
landing — a later migration corrects an earlier one.

## Contents

- `0001_merqo_core.sql` — creates the `merqo` schema and its foundation:
  `merqo_team` (membership), `products` (the kit registry — `slug`,
  `app_url`, `metrics_url`, `metrics_secret`, `status` CHECK'd to
  `live`/`coming_soon`), and `vendor_links` (email-keyed vendor↔kit grants,
  `active`/`waitlist`). RLS default-deny; team access via
  `merqo.is_merqo_team()`.
- `0002_coming_kits.sql` — seeds the `coming_soon` product rows the public
  landing's waitlist form needs to point at (display copy lives in
  `src/lib/kits.ts`; this only backs the FK).
- `0003_vendor_read.sql` — lets a signed-in vendor read their own
  `vendor_links` rows (`/dashboard` kit tiles); hardens the policy to
  case-insensitive email matching.
- `0004_kit_consolidation.sql` — retires `tapkit`/`slotkit`, adds
  `paykit`/`stockkit`/`reachkit`, and gives every kit its own `app_url`;
  carries any `tapkit` waitlist rows onto `paykit` first.
- `0005_vendor_link_sync.sql` — adds `vendor_links.last_verified_at`
  (nullable; NULL = manually granted, non-NULL = last written by
  `syncVendorKits`) for the vendor-membership pull-sync.
- `0006_vendor_link_tier.sql` — adds `vendor_links.plan` (nullable, no
  CHECK — different kits may use different tier vocabularies) for the
  self-serve kit-toggle feature.
- `0007_feedback_and_support.sql` — `merqo.support_messages`: hub-level
  help requests (vendor access/billing/team/catch-all categories), mirroring
  qkit's own table shape.
- `0008_kit_events.sql` — `merqo.kit_events`: a thin cross-kit signal log
  (event + vendor + small payload) so one kit can verify another kit's
  event happened without an HTTP round-trip, since every kit already shares
  one Postgres instance. Not a shared data store — each kit still owns its
  own domain data.
- `0009_vendor_profile.sql` — `merqo.vendor_profile`: the shared stall
  name + social-links identity every kit reads/writes once instead of
  re-onboarding per kit (`get_or_create_vendor_profile`/
  `upsert_vendor_profile` RPCs, wrapped by each kit's own
  `merqo-vendor-profile.ts`).
- `0010_cross_kit_support_messages.sql` — widens `support_messages` into a
  true cross-kit inbox: nullable `kit_slug` (NULL still means "about the
  hub itself") and a shape-only category CHECK, since each kit now owns its
  own category vocabulary at the app layer.
- `0011_vendor_feedback.sql` — `merqo.vendor_feedback`: shared vendor NPS,
  converged from loopkit/stockkit/paykit's previously-identical local
  tables. Writes only through `submit_vendor_feedback` (SECURITY DEFINER).
- `0012_service_role_table_grants.sql` — `0001`'s blanket
  `grant all ... to service_role` only covered tables that existed at that
  moment; explicitly (re-)grants every table added since
  (`support_messages`/`kit_events`/`vendor_profile`/`vendor_feedback`) so
  the service client's direct reads/writes on them actually work.
- `0013_fix_loopkit_live_status_and_provision_secret.sql` — loopkit was
  seeded `coming_soon` in `0004` despite being fully live in `kits.ts`,
  silently excluding it from `listLiveProducts()`-gated sync; flips it to
  `live` and adds the (separate, push-only) `products.provision_secret`
  column.
- `0014_paykit_live_and_needs_setup_status.sql` — same bug for paykit
  (flips it `live`); also widens `vendor_links.status` to a third value,
  `needs_setup`, for a kit that's identity-provisioned but needs a further
  manual step (paykit's real PayNow/bank details) before being truly active.
- `0015_vendor_avatars_bucket.sql` — the `vendor-avatars` public Storage
  bucket backing `/profile`'s avatar upload, mirroring qkit's booth-images
  bucket pattern.
- `0016_merqo_dashboard_prefs.sql` — `merqo.dashboard_prefs`: Merqo's own
  `/dashboard` tour "seen" state — deliberately not a column on the shared
  `vendor_profile` table, since a vendor may have seen one kit's onboarding
  tour without having seen Merqo's own.
- `0017_billing_settings.sql` — `merqo.billing_settings`: a public-read,
  service-role-write-only singleton row backing the cross-kit
  bundle-discount toggle (same shape as qkit's own `platform_settings`).
- `0018_customers.sql` — `merqo.customers`: shared cross-kit customer
  identity keyed on `(vendor_id, phone)`, mirroring loopkit's own proven
  shape — closes the gap where only vendor identity, not customer identity,
  was shared across kits.
- `0019_customer_telegram.sql` — widens `customers` into a Telegram-or-phone
  identity (nullable `phone`, new `telegram_chat_id`/`consent_given_at`/
  `pending_notify_ref`, an "at least one identity" CHECK) and adds
  `telegram_link_tokens`, for merqo's own third Telegram bot (Phase B+D of
  the cross-kit Telegram design, distinct from each kit's now-retired
  per-kit bots).
- `0020_vendor_telegram.sql` — Phase A2: consolidates qkit's and loopkit's
  own per-kit vendor-alert bots onto merqo's shared bot from `0019`. Adds a
  `kind` column to `telegram_link_tokens` (`customer`/`vendor`) and a new
  `vendor_telegram` table (own-row RLS `select`, service-role-only writes).
- `0021_admin_audit.sql` — `merqo.admin_audit`: the audit trail every
  sibling kit already had but merqo itself lacked — kit-access grant/revoke,
  team add/remove, the bundle-discount toggle, support-message resolution.
  Immutable from day one (service_role gets `select`/`insert` only, no
  `update`/`delete`).
- `0022_stockkit_live.sql` — same bug class as `0013`/`0014`: stockkit was
  still seeded `coming_soon` despite shipping its own full merqo cutover
  (metrics/vendor-status/vendor-provision/vendor-activity endpoints) in the
  same work session as this migration; flips it to `live`.
- `0023_vendor_sync_state.sql` — `merqo.vendor_sync_state` (`email` PK,
  `last_synced_at`): a per-email throttle marker so `syncVendorKits()` skips
  its per-kit HTTP fan-out within a 60s window, now that `/dashboard` is open
  to every signed-in user and re-syncs on every render. Service-role only,
  RLS-on with zero client policies (same shape as `telegram_link_tokens`).

## Connectivity

Applied via the Supabase CLI (`supabase db push`/`db reset`, or the
project's `/supabase-migrate` skill) against the local or hosted Postgres
instance configured in `../config.toml`. `src/lib/products.ts`'s
`listLiveProducts()` is gated on `products.status = 'live'` — a kit seeded
`coming_soon` (the bug `0013`/`0014`/`0022` each independently fixed) is
silently excluded from vendor sync, provisioning, metrics, and activity
pulls even once its own app-side endpoints exist. `src/lib/types.ts` mirrors
the resulting schema by hand and must be kept in sync after any migration
lands.

## Parent

See the repo root [README.md](../../README.md) for the full repo layout.
