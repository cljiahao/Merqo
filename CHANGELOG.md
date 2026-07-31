# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Savings-estimate info tooltips on the dashboard, explaining the flat
  per-kit/per-plan methodology behind the "Est. $X saved" figures.

### Fixed

- Dashboard navbar/logo, avatar menu, and profile page brought to parity with
  qkit/loopkit/paykit's established patterns: the dashboard Wordmark is now
  a clickable link and the header uses fluid padding instead of a fixed
  height; the avatar menu's "Get help" and "Report a problem" items are
  merged into one, matching every sibling kit; the profile page now has
  stall name, profile icon upload, change password, display name, and
  social links, wired to the shared `merqo.vendor_profile` RPCs.
- Google OAuth sign-in now forces English (`hl=en`) so the consent screen
  doesn't fall back to the browser/account locale.

### Changed

- Migrated git hooks from lefthook to husky — lefthook's unsigned
  `lefthook.exe` is unconditionally blocked by Windows Smart App Control on
  this machine; husky has no native binary. Same checks, same rigor.
- **templateCentral 5.12 harness migration.** `next` pin
  loosened from an exact version to `^16.2.11` to match the canonical scaffold
  convention (already on the CVE-2026-64642 floor, no behavior change).
  `.claude/settings.json`'s `permissions.deny` gained the canonical
  `Read(./.secrets/**)`, `Read(**/.env.*)`, `Read(./**/dist/**)`, and
  `Read(./**/.turbo/**)` entries alongside the existing enumerated ones.
  `.claude/skill-usage.log` added to `.gitignore` ahead of first use.

### Fixed

- **The admin console had no mobile burger/hamburger menu.** `AdminNav` was a
  flat, non-collapsing link row that wrapped or overflowed on small screens —
  the only nav in the whole kit family without a collapsing mobile menu.
  Restructured `AdminNav` to own the entire sticky header (burger + wordmark
  - `AccountMenu`) instead of splitting it across `layout.tsx` and a client
    subcomponent, so the burger's open/close state and the mobile tab panel it
    reveals live in one place. Now matches every kit's burger-beside-logo
    pattern. `AGENTS.md` and the affected READMEs were synced to the current
    file layout in the same pass.
- **loopkit's `products.status` was incorrectly `coming_soon`**, excluding it
  from vendor auto-discovery (`listLiveProducts()`) since the `0004` kit-
  consolidation migration, despite `src/lib/kits.ts` already showing it as
  fully live. Corrected in `0013_fix_loopkit_live_status_and_provision_secret.sql`.
- **A newly-added kit never appeared on `/dashboard` without a full logout/
  login.** "Add {kit}" just opens the other kit's own signup page — merqo
  only re-checks `vendor_links` via `syncVendorKits` from `/post-login`
  (a fresh sign-in). `/dashboard/pending` already had a defensive sync +
  "Check again" for the zero-active-kits case, but `/dashboard` itself (what
  a vendor with an existing active kit lands on) never synced at all.
  `/dashboard` now syncs on every load, the same as `/dashboard/pending`.

- **`service_role` couldn't read tables added after the first migration.**
  0001's `grant all on all tables in schema merqo to service_role` only
  covered tables that existed when it ran — every table added since
  (`support_messages`, `kit_events`, `vendor_profile`, `vendor_feedback`)
  never got an equivalent grant, so a byte-for-byte fresh migration replay
  (a new local dev instance, or CI) hit permission-denied on the service
  client's direct reads (e.g. the admin Overview page's support-message
  read). New migration `0012_service_role_table_grants.sql` re-applies the
  grant to cover everything added since. Found via real local-Supabase e2e
  testing, not the pgTAP suite (which runs as the Postgres superuser and
  never exercises table-level grants).
- **Team lookup past 1000 auth users.** `listTeamMembers`/`addTeamMemberByEmail`
  (`src/lib/admin.ts`) now paginate `auth.admin.listUsers` instead of reading
  page 1 only, so accounts and team-member emails beyond the first 1000 auth
  users are no longer silently missed.
- Added pgTAP RLS coverage for `kit_events`, `vendor_profile`, and
  `vendor_feedback` (previously untested policies).

### Added

- **paykit joins the vendor push-provisioning system as a read-only identity
  check.** Unlike qkit/loopkit, paykit's provisioning route can't safely
  activate a vendor with a default plan (payments has no safe default to
  write), so it only verifies the vendor's identity and leaves activation to
  the vendor themselves. A new `vendor_links.status = 'needs_setup'` state
  covers this: `/dashboard` and `/dashboard/pending` render it as a
  "Finish payment setup" deep-link to the kit's own dashboard instead of
  treating it as active or pending.
- **One-click vendor kit activation.** A signed-in vendor can now activate
  qkit and/or loopkit directly from the Merqo dashboard — a bulk "Activate
  all my kits" button on `/dashboard/pending` plus per-kit "Add {kit}"
  buttons on `/dashboard`'s "Ready to add" section — without visiting that
  kit's own signup page. Backed by a new server action
  (`activateKitsAction`) that fans out to each kit's new
  `POST /api/merqo/vendor-provision` route in parallel, and by
  `provisionableKits()` (`src/lib/vendor.ts`), which derives the addable-kit
  list from the live registry's actual provisioning capability
  (`merqo.products.provision_secret`), not `kits.ts`'s display tier.
- **Estimated savings panel on the vendor dashboard.** Each active kit card on
  `/dashboard` now shows an estimated dollar/hours-saved figure for the
  vendor's current plan tier, with a Pro-upgrade delta shown when the vendor
  is on Free, plus a page-level summary banner totaling the estimate across
  all of a vendor's active kits. New module `src/lib/savings.ts` holds the
  numbers — flat per-kit/per-tier assumptions, not measured per-vendor usage
  (no such data exists in the metrics pipeline), grounded in Singapore
  hawker-wage and industry-benchmark research. See
  `docs/superpowers/specs/2026-07-26-merqo-dashboard-savings-estimate-design.md`
  for the full sourcing.
- **Real admin-interaction e2e coverage.** `e2e/smoke.spec.ts`'s `authed areas`
  block now actually logs in and exercises the grant/revoke-a-kit and
  add/remove-team-member flows against a real local Supabase instance,
  instead of only render checks behind an always-skipped flag. A new CI job
  (`e2e (admin interaction)`) boots local Supabase (`supabase/config.toml`
  is new — first committed local-dev config for this repo, exposes the
  `merqo` schema), seeds a team member + addable user + test product via
  the GoTrue admin API and PostgREST, and runs the suite with
  `MERQO_E2E_AUTH=1`.
- **Cross-kit vendor feedback/NPS.** `merqo.vendor_feedback` converges
  loopkit/stockkit/paykit's identical local NPS tables via a new
  `merqo.submit_vendor_feedback` RPC. The admin feedback page now shows a
  per-kit NPS breakdown alongside Merqo hub's own NPS, plus a combined
  vendor-comments list tagged with which kit each one came from.
- **Cross-kit support inbox.** `merqo.support_messages` now accepts messages
  from any kit (not just Merqo hub itself) via a new
  `merqo.submit_support_message` RPC — a nullable `kit_slug` records which
  product a message is about (`null` stays the existing "about Merqo hub"
  meaning). The admin page shows the raw category plus which kit a message
  came from. paykit is the first kit wired up as a consumer.
- **Last-synced timestamp on each active kit card.** `/dashboard` now shows
  "As of {time ago}" as a trust signal per kit. Paired with a new per-vendor
  usage metrics section, backed by a `GET /api/merqo/vendor-metrics`
  contract kits can optionally implement — degrades gracefully to "Stats
  aren't connected here yet" for every kit today, since none implement it
  yet.
