-- Vendor tier display (self-serve kit toggle feature — see
-- docs/superpowers/specs/2026-07-10-merqo-self-serve-kit-toggle-design.md).
-- NULL = never synced with a plan value (e.g. a manually-granted row).
-- Non-NULL = the tier the kit last reported for this vendor, written by
-- syncVendorKits alongside last_verified_at. No CHECK — different kits may
-- introduce different tier vocabularies later.
alter table merqo.vendor_links
  add column if not exists plan text;
