-- Bugfix found while scoping vendor push-provisioning (2026-07-28 design):
-- loopkit was seeded as 'coming_soon' in 0004_kit_consolidation.sql despite
-- src/lib/kits.ts already showing it as fully live — listLiveProducts()
-- filters on THIS column, so the existing pull-sync has silently excluded
-- loopkit from vendor auto-discovery since 0004. Fixing here also closes
-- that pre-existing gap as a side effect.
update merqo.products set status = 'live' where slug = 'loopkit';

-- New column for the vendor-provision write endpoint's bearer secret —
-- deliberately a SEPARATE secret from metrics_secret (read-only), added as
-- a nullable column here; the actual secret VALUE is set out-of-band via
-- the Supabase dashboard/SQL editor (same pattern metrics_secret already
-- uses — never commit a real secret value in a migration file).
alter table merqo.products
  add column if not exists provision_secret text; -- server-only; never read by anon/client
