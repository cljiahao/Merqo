# test/lib

## Purpose

Unit tests for `src/lib/*` modules that don't need DOM rendering (schemas,
formatters, gating logic, API-payload validation) — mirrors `src/lib`'s file
names one-to-one.

## Contents

- `account.test.ts` — `src/lib/account.ts` metadata field reads.
- `admin.test.ts` — `src/lib/admin.ts`'s read helpers (team/grant listing) and write paths (`grantKit`/`revokeKit`/`removeTeamMember`, incl. duplicate-grant and not-found edge cases), all against a mocked Supabase service client.
- `downgrade-request.test.ts` — `src/lib/downgrade-request.ts`'s metrics-API call.
- `ecosystem.test.ts` — the kit-stacker graph data/edge logic in `src/lib/ecosystem.ts`.
- `feedback-action.test.ts` — the vendor feedback Server Action.
- `feedback-support-schemas.test.ts` — the feedback/support Zod schemas.
- `format.test.ts` — `money()` and the other display formatters in `src/lib/format.ts`.
- `funnel.test.ts` — the onboarding funnel counts in `src/lib/funnel.ts`.
- `health.test.ts` — the `reporting`/`lagging`/`down` classifier in `src/lib/health.ts`.
- `join-waitlist.test.ts` — the dashboard "Join waitlist" Server Action.
- `kit-action-request.test.ts` — `src/lib/kit-action-request.ts`'s shared `fetchKitJson`/`postKitAction` helpers (network/HTTP/parse/schema failure modes).
- `kits.test.ts` — the kit family config in `src/lib/kits.ts` (slugs, live/coming/planned status, hrefs).
- `merqo-vendor-profile.test.ts` — the vendor-profile RPC wrapper.
- `metrics-client.test.ts` — the platform metrics fetch + schema validation.
- `nps.test.ts` — NPS bucketing/scoring in `src/lib/nps.ts`.
- `overview.test.ts` — the admin overview's metrics aggregation.
- `resolve-support-message-action.test.ts` — the admin's resolve-support-message Server Action.
- `schemas.test.ts` — the shared vendor-profile social/website link schemas.
- `support-action.test.ts` — the vendor support-message submission Server Action.
- `support.test.ts` — the open-support-messages read in `src/lib/support.ts`.
- `upgrade-request.test.ts` — `src/lib/upgrade-request.ts`'s metrics-API call.
- `vendor-grants.test.ts` — the client-safe `GrantStatus` helpers in `src/lib/vendor-grants.ts`.
- `vendor-metrics-client.test.ts` — the per-vendor stats fetch + schema validation.
- `vendor-sync.test.ts` — vendor kit-grant provisioning/sync.
- `vendor.test.ts` — the vendor dashboard session/grant gate in `src/lib/vendor.ts`.

## Parent

See the repo root [README.md](../../README.md) for the full test layout.
