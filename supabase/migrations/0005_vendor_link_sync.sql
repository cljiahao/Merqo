-- Vendor-membership sync (Phase A, empty-state discovery — see
-- docs/superpowers/specs/2026-07-09-merqo-vendor-membership-sync-design.md).
-- NULL = manually granted by a Merqo team member, never touched by sync.
-- Non-NULL = written by syncVendorKits at the moment it verified the vendor
-- against the kit. Phase A never reads this column back (no TTL/reconciliation
-- sweep yet); it exists now so a later Phase B can key off it without another
-- migration.
alter table merqo.vendor_links
  add column if not exists last_verified_at timestamptz;
