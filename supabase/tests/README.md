# tests

## Purpose

pgTAP RLS isolation suite, run via `supabase test db`.

## Contents

- `rls.test.sql` — one rolled-back transaction covering every RLS-bearing
  table in the `merqo` schema with inline fixed-UUID fixtures: RLS-enabled
  checks, own-row-vs-team-select policy assertions, grant-restriction
  checks (`authenticated`/`anon` denial where the table is service-role
  only), and unique-constraint / idempotency assertions on tables that
  need them (e.g. `legal_acceptances`). Includes coverage for
  `merqo.legal_acceptances` (migration `0024`, `legal_name` column added
  in `0027`) and the `clear_customer_consent_by_telegram` /
  `find_customer_telegram_by_phone` RPCs (migrations `0025`, `0026`).

## Connectivity

Run by `.github/workflows/ci.yml`'s `db` job on every PR; applies every
migration in `../migrations/` first via `supabase start`.

## Parent

[merqo](../../README.md)
