# Vendor Telegram Connect (Phase A2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate Phase A's per-kit vendor-alert bots onto merqo's own
bot — a new `merqo.vendor_telegram` table, a `kind` discriminator on
`telegram_link_tokens`, two new endpoints (`vendor-connect-token`,
`notify-vendor`), and a new profile-settings UI component in
`@merqo/ui`. This unblocks qkit's and loopkit's own Phase A2 plans, which
retire their local bots and call these endpoints instead.

**Spec:** `docs/superpowers/specs/2026-08-16-vendor-telegram-connect-design.md`

## Global Constraints

- `merqo.telegram_link_tokens`'s new `kind` column must backfill every
  pre-existing row to `'customer'` — verify with a real query against a
  seeded row, not just the migration syntax.
- The webhook's `kind='customer'` branch must keep passing its existing
  tests unchanged (regression, not just new coverage) — this is a shared
  route with real Phase B+D traffic already live on `main`.
- `notify-vendor` never throws to its caller in a way that could look like
  a hard failure the kit should retry aggressively — same no-op-on-
  no-match rule as `notify-customer`.
- TypeScript strict, no `any`.
- Work on a feature branch, never commit directly to `main`.
- Run `pnpm check && pnpm test && pnpm build` before opening the PR.

---

### Task 0: Branch setup

```bash
git fetch origin main
git checkout -b feat/vendor-telegram-connect origin/main
```

Confirm `pnpm test` passes on baseline first.

---

### Task 1: Migration

**Files:** `supabase/migrations/0020_vendor_telegram.sql`

- [ ] Write the migration exactly as in the spec's "What changes" section
      (`merqo.vendor_telegram` + the `kind` column/constraint on
      `telegram_link_tokens`, with `notify_ref`/`kit_slug` now nullable).
- [ ] Apply locally; confirm an existing `telegram_link_tokens` row (if
      any test/seed data has one) backfills to `kind='customer'`.
- [ ] Commit: `feat: add merqo.vendor_telegram, widen telegram_link_tokens with a kind column`.

### Task 2: Webhook branching

**Files:** `src/app/api/telegram/webhook/route.ts`,
`src/app/api/telegram/webhook/route.test.ts` (extend)

- [ ] Failing tests first: a `kind='vendor'` token's `/start` upserts
      `merqo.vendor_telegram` on `(vendor_id, chat_id)` and deletes the
      token; the existing `kind='customer'` behavior (upserts
      `merqo.customers`, sets `consent_given_at`/`pending_notify_ref`) is
      unchanged — re-run/extend the existing test cases, don't just add
      new ones.
- [ ] Implement the `kind` branch.
- [ ] Commit: `feat: branch the Telegram webhook's /start handler on link-token kind`.

### Task 3: `vendor-connect-token` route

**Files:** `src/app/api/merqo/vendor-connect-token/route.ts`,
`src/app/api/merqo/vendor-connect-token/route.test.ts`

- [ ] Failing tests first: 401 without the secret; a valid
      `{ vendor_id, kit_slug }` body mints a `kind='vendor'` token and
      returns `{ token, deep_link }`; a malformed body 400s via Zod.
- [ ] Implement per the spec.
- [ ] Commit: `feat: add vendor-connect-token endpoint`.

### Task 4: `notify-vendor` route

**Files:** `src/app/api/merqo/notify-vendor/route.ts`,
`src/app/api/merqo/notify-vendor/route.test.ts`

- [ ] Failing tests first: 401 without the secret; a matching `vendor_id`
      sends via `sendTelegramMessage`; no match is a silent 200, not an
      error.
- [ ] Implement per the spec.
- [ ] Commit: `feat: add notify-vendor endpoint`.

### Task 5: Profile-settings component (`@merqo/ui`)

**Files:** in the `merqo-ui` repo — `src/vendor-telegram-section.tsx` (or
similar name, avoid colliding with qkit's own customer-facing
`TelegramConnect`), its test, exported from `src/index.ts`; then wired
into merqo's own `src/app/profile/` page.

- [ ] In `merqo-ui`: failing tests first (disconnected state renders a
      connect link/QR; connected state shows status + a disconnect
      action), implement, bump `merqo-ui`'s own version, tag it, then come
      back to merqo and bump its `@merqo/ui` dependency (same two-repo
      sequencing as every other `@merqo/ui` change this session).
- [ ] In merqo: wire the component into `src/app/profile/page.tsx` in a
      single-column layout slot, backed by a new server action that mints
      a connect token directly (no HTTP hop, same-app) and a query
      reading `merqo.vendor_telegram` for current status.
- [ ] Commit: `feat: add vendor Telegram connect section to the profile page`.

### Task 6: RLS coverage

**Files:** `supabase/tests/rls.test.sql` (extend)

- [ ] Add coverage for `merqo.vendor_telegram` — own-row select works, no
      client write grant.
- [ ] `supabase test db` passes.
- [ ] Commit: `test: extend RLS coverage for merqo.vendor_telegram`.

### Task 7: Docs

**Files:** `AGENTS.md`, `CHANGELOG.md`

- [ ] Update `AGENTS.md`'s data model / file layout sections to document
      the new table, routes, and the Phase A → A2 supersession (name it
      explicitly, matching the master doc's own framing).
- [ ] Add a `CHANGELOG.md` entry.

### Task 8: Verification gate

- [ ] `pnpm check && pnpm test && pnpm build`.
- [ ] Push, PR, poll CI green (`gh pr checks <N> --watch` — block on it
      yourself, no monitor exists), squash-merge.

## Self-Review Notes

- Spec coverage: migration (1), webhook branching (2), connect-token
  endpoint (3), notify-vendor endpoint (4), profile UI (5), RLS (6),
  docs (7), verification (8).
- Task 2 explicitly re-verifies the existing customer-flow tests still
  pass, not just that the new vendor branch works — this route already
  carries live Phase B+D traffic.
- This must merge and deploy before qkit's and loopkit's own Phase A2
  plans can retire their local bots against a real endpoint — sequencing
  note for whoever picks those up next.
