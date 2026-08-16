# Customer Telegram Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** merqo's own Telegram bot + webhook, and two new bearer-secret
HTTP endpoints (`customer-connect-token`, `notify-customer`) that qkit and
loopkit call to let a customer connect once and receive transactional
order/reward notifications across every Merqo kit they interact with.
This is the first kit → merqo HTTP direction in the codebase.

**Spec:** `docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md`

## Global Constraints

- `customerNotifySecretOk` must use a constant-time compare
  (`node:crypto`'s `timingSafeEqual`), mirroring qkit's own
  `provisionBearerOk` shape (`../qkit/src/lib/merqo-auth.ts`) — the first
  time merqo itself is the receiving side of a bearer-authenticated call.
- `merqo.telegram_link_tokens`: RLS enabled, zero client policies —
  service-role only, same shape as every other `*_link_tokens` table in
  this ecosystem's Phase A work.
- The webhook route must verify `X-Telegram-Bot-Api-Secret-Token` before
  touching any data, and always respond 200 to a Telegram-shaped payload
  regardless of internal outcome (Telegram retries aggressively on
  non-2xx) — same rule as qkit's/loopkit's own Phase A webhooks.
- `notify-customer`'s two lookup modes (`notify_ref` XOR `phone`) are
  mutually exclusive — reject a request carrying both or neither with a
  400, don't silently prefer one.
- `pending_notify_ref` is single-use (cleared after a successful
  `notify_ref`-mode send); a `phone`-mode send never clears anything —
  test both, don't just claim it in a comment.
- TypeScript strict, no `any`.
- Work on a feature branch, never commit directly to `main`.
- Run `pnpm check && pnpm test && pnpm build` before opening the PR.

---

### Task 0: Branch setup

```bash
git fetch origin main
git checkout -b feat/customer-telegram-connect origin/main
```

Confirm `pnpm test` passes on baseline first.

---

### Task 1: Migration

**Files:** `supabase/migrations/0019_customer_telegram.sql`

- [ ] Write the migration exactly as in the spec's "What changes" section:
      the `merqo.customers` widening (surrogate `id` PK, nullable `phone`,
      new `telegram_chat_id`/`consent_given_at`/`pending_notify_ref`
      columns, the `customers_identity_check` constraint, both partial
      unique indexes) plus the new `merqo.telegram_link_tokens` table
      (RLS enabled, zero policies).
- [ ] Apply locally (`/supabase-migrate` skill or equivalent).
- [ ] Commit: `feat: widen merqo.customers for Telegram identity, add telegram_link_tokens`.

### Task 2: `src/lib/telegram.ts`

**Files:** `src/lib/telegram.ts`, `src/lib/telegram.test.ts`

- [ ] Failing tests first: same assertions as qkit's/loopkit's own copy —
      `sendTelegramMessage` posts the right URL/body, no-ops when
      `TELEGRAM_BOT_TOKEN` is unset, catches+logs a fetch rejection;
      `generateLinkToken()` matches `/^[A-Za-z0-9_-]{1,64}$/`.
- [ ] Implement per the spec (identical shape to every other kit's copy —
      this is deliberately not shared as a package).
- [ ] Commit: `feat: add sendTelegramMessage and generateLinkToken helpers`.

### Task 3: `src/lib/customer-notify-auth.ts`

**Files:** `src/lib/customer-notify-auth.ts`,
`src/lib/customer-notify-auth.test.ts`

- [ ] Failing tests first: valid `Authorization: Bearer <MERQO_CUSTOMER_SECRET>`
      passes; missing header, wrong prefix, wrong secret, and
      wrong-length secret all fail; no `MERQO_CUSTOMER_SECRET` configured
      always fails closed.
- [ ] Implement `customerNotifySecretOk(request: Request): boolean`,
      mirroring qkit's `provisionBearerOk` constant-time-compare shape.
- [ ] Commit: `feat: add customerNotifySecretOk bearer-token guard`.

### Task 4: Telegram webhook route

**Files:** `src/app/api/telegram/webhook/route.ts`,
`src/app/api/telegram/webhook/route.test.ts`

- [ ] Failing tests first: 401 on missing/wrong secret-token header; a
      valid `/start <token>` against an unexpired `telegram_link_tokens`
      row upserts `merqo.customers` keyed on `telegram_chat_id` (not the
      existing phone-keyed `upsert_customer` RPC path — this is a
      distinct insert path for a customer with no phone yet), sets
      `consent_given_at = now()` and `pending_notify_ref` from the
      token's `notify_ref`, and deletes the token; an expired/unknown
      token responds without writing anything; always 200s to a
      Telegram-shaped payload.
- [ ] Implement per the spec.
- [ ] Confirm this route needs no auth-gate exclusion (merqo has no
      `src/proxy.ts` route guard covering `/api/*` the way qkit/loopkit
      do — verify this against the actual proxy matcher before assuming;
      if one exists, exclude this path same as the sibling kits do).
- [ ] Commit: `feat: add merqo Telegram webhook route`.

### Task 5: `customer-connect-token` route

**Files:** `src/app/api/merqo/customer-connect-token/route.ts`,
`src/app/api/merqo/customer-connect-token/route.test.ts`

- [ ] Failing tests first: 401 without `customerNotifySecretOk`; a valid
      `{ vendor_id, kit_slug, notify_ref }` body mints a token (30-minute
      expiry), inserts `telegram_link_tokens`, and returns
      `{ token, deep_link }` with the correct `t.me/<bot>?start=<token>`
      shape; a malformed body (missing field, wrong type) 400s via Zod.
- [ ] Implement per the spec.
- [ ] Commit: `feat: add customer-connect-token endpoint`.

### Task 6: `notify-customer` route

**Files:** `src/app/api/merqo/notify-customer/route.ts`,
`src/app/api/merqo/notify-customer/route.test.ts`

- [ ] Failing tests first: 401 without the secret; 400 when both or
      neither of `notify_ref`/`phone` are present; `notify_ref` mode —
      matching `pending_notify_ref` sends and clears the ref, no match is
      a silent 200; `phone` mode — matching `phone` with a non-null
      `telegram_chat_id` sends and does NOT clear anything, no match is a
      silent 200.
- [ ] Implement per the spec (both lookup modes).
- [ ] Commit: `feat: add notify-customer endpoint with notify_ref/phone modes`.

### Task 7: RLS coverage

**Files:** `supabase/tests/rls.test.sql` (extend)

- [ ] Add coverage for the widened `merqo.customers` (no client access to
      the new columns beyond whatever the existing RLS shape already
      grants — verify, don't assume, since the PK/constraint change might
      interact with existing policies) and `merqo.telegram_link_tokens`
      (zero client policies, service-role only).
- [ ] `supabase test db` passes.
- [ ] Commit: `test: extend RLS coverage for customer Telegram identity`.

### Task 8: `.env.example` + docs

**Files:** `.env.example`, `AGENTS.md`, `src/lib/README.md` (or
equivalent), `src/app/api/README.md`, `CHANGELOG.md`

- [ ] Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and
      `MERQO_CUSTOMER_SECRET` to `.env.example` — note that this is a
      **third, separate bot** from qkit's and loopkit's own Phase A bots
      (own BotFather registration, own token), and that the one-time
      `setWebhook` call is a manual deploy step, not automated here (note
      it in `docs/DEPLOY.md` alongside the existing deploy notes).
- [ ] Update `AGENTS.md`'s data model / file layout / Project-Specific
      Notes sections to document the new tables, routes, and the
      kit → merqo architectural direction (name it explicitly, per the
      spec's self-review note — don't let it read as if this pattern
      already existed).
- [ ] Add a `CHANGELOG.md` entry.

### Task 9: Verification gate

- [ ] `pnpm check && pnpm test && pnpm build`.
- [ ] Push, PR, poll CI green, squash-merge.

## Self-Review Notes

- Spec coverage: migration (Task 1), Telegram helper (Task 2), auth guard
  (Task 3), webhook (Task 4), connect-token endpoint (Task 5),
  notify-customer endpoint with both modes (Task 6), RLS (Task 7),
  docs/env (Task 8), verification (Task 9).
- Both `notify-customer` lookup modes are independently tested in Task 6
  — not just the `notify_ref` mode qkit uses, since loopkit's spec
  depends on the `phone` mode existing and working correctly here first.
- This must merge and deploy (env vars set, `setWebhook` called) before
  qkit's and loopkit's own customer-telegram-connect plans can be
  implemented against real endpoints — sequencing note for whoever picks
  those up next, not enforced by tooling.
