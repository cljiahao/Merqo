# db

## Purpose

Static, no-DB-connection coverage of `supabase/migrations/*.sql`: reads each
migration file as text and asserts it contains the SQL statements it's
supposed to (a status flip, a constraint shape, a grant). Catches an
obviously-wrong migration body (typo'd slug, wrong constraint values, a
copy-paste that didn't get its literal updated) without needing a real
Postgres instance — there's no pgTAP suite in this repo, unlike each kit's
own `supabase/tests/rls.test.sql`.

## Contents

- `0013_fix_loopkit_live_status_and_provision_secret.test.ts` — asserts the
  `status = 'live'` flip for `loopkit` and the new `provision_secret` column.
- `0014_paykit_live_and_needs_setup_status.test.ts` — asserts the `status
= 'live'` flip for `paykit`, the dynamic drop of the unnamed
  `vendor_links` status CHECK, and the re-added named constraint allowing
  `needs_setup`.
- `0015_vendor_avatars_bucket.test.ts` — asserts the `vendor-avatars`
  Storage bucket insert.
- `0016_merqo_dashboard_prefs.test.ts` — asserts the `dashboard_prefs` table
  - its RLS shape.
- `0019_customer_telegram.test.ts` — asserts the `customers` identity
  widening and the new `telegram_link_tokens` table.
- `0022_stockkit_live.test.ts` — asserts the `status = 'live'` flip for
  `stockkit`.
- `consolidation.test.ts` — covers `0004_kit_consolidation.sql`'s
  product-registry upsert and tapkit→paykit waitlist carry-over.
- `cross-kit-support-messages-schema.test.ts` — covers
  `0010_cross_kit_support_messages.sql`'s `kit_slug`/category widening.
- `feedback_and_support.test.ts` — covers `0007_feedback_and_support.sql`'s
  `support_messages` table shape.
- `kit-events-schema.test.ts` — covers `0008_kit_events.sql`'s thin
  cross-kit signal-log table.
- `schema.test.ts` — covers `0001_merqo_core.sql`'s foundation tables
  (`merqo_team`/`products`/`vendor_links`).
- `vendor-feedback-schema.test.ts` — covers `0011_vendor_feedback.sql`'s
  shared NPS table + `submit_vendor_feedback` RPC.
- `vendor-link-sync.test.ts` / `vendor-link-tier.test.ts` — cover
  `0005`/`0006`'s `last_verified_at`/`plan` columns.
- `vendor-profile-schema.test.ts` — covers `0009_vendor_profile.sql`'s
  shared stall-name/social-links table.
- `vendor-read.test.ts` — covers `0003_vendor_read.sql`'s own-row read
  grant/policy.

## Parent

See the repo root [README.md](../../README.md).
