# Customer Telegram Connect — Design

**Date:** 2026-08-16
**Status:** Approved; plan to follow.

## Summary

merqo's half of `Merqo Business/docs/business/2026-08-16-telegram-
integration-design.md`'s Phase B+D — a third Telegram bot (distinct from
qkit's and loopkit's own Phase A vendor-alert bots), owned by merqo, that
lets a customer connect once and receive transactional notifications
(order ready, reward redeemed) from any Merqo kit they interact with.
**Read the master design doc's "Phase B + D" section in full first** — the
PDPA-researched consent model and the stated cross-kit-reuse limitation
are decided there, not re-derived here.

## Guiding decisions

- **A new architectural direction: kit → merqo HTTP calls.** Every
  existing cross-kit HTTP call in this ecosystem flows merqo → kit
  (metrics pull, vendor-provision). This is the first kit → merqo
  direction. New shared secret, `MERQO_CUSTOMER_SECRET` — same simple
  shared-bearer-token pattern `MERQO_METRICS_SECRET` already uses (one
  value known by merqo and every participating kit), not a per-kit-unique
  key system like paykit's `kit_api_keys` — this doesn't need that level
  of isolation for a first version.
- **The `sendMessage` call has to live in application code, not SQL** —
  same reasoning Phase A already established (Postgres has no simple
  outbound-HTTP path). Both new endpoints are real Next.js API routes.
- **`merqo.customers` widened, not replaced** — the exact migration is in
  the master design doc's Phase B+D section; not repeated here.
- **Consent copy lives in exactly one place** — this repo, since this is
  the one bot/webhook/connect-flow serving every kit. A kit's own UI
  quotes the connect-button label but never re-writes the disclosure text.

## What changes

### `supabase/migrations/0019_customer_telegram.sql` (new)

The `merqo.customers` widening SQL from the master design doc's Phase B+D
section, plus:

```sql
create table merqo.telegram_link_tokens (
  token         text primary key,
  vendor_id     uuid not null references auth.users(id) on delete cascade,
  kit_slug      text not null,
  notify_ref    text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

alter table merqo.telegram_link_tokens enable row level security;
-- RLS enabled, zero policies — service-role only, same shape as every
-- other *_link_tokens table in this session's Phase A work.
```

### `src/lib/telegram.ts` (new)

Same `sendTelegramMessage`/`generateLinkToken` shape as every kit's own
Phase A module — not shared as a package (matches this codebase's
established convention of small server-side modules staying kit-local
even when the pattern repeats), just the identical small implementation.

### `src/lib/customer-notify-auth.ts` (new)

`customerNotifySecretOk(request: Request): boolean` — checks the
`Authorization: Bearer <MERQO_CUSTOMER_SECRET>` header via a constant-time
compare (`node:crypto`'s `timingSafeEqual`). **This is a genuinely new
pattern for this repo** — merqo has never been the _receiving_ side of a
bearer-authenticated call before (every existing cross-kit call flows
merqo → kit: metrics pull, vendor-provision). The shape to copy is
`provisionBearerOk` in **qkit's own** `src/lib/merqo-auth.ts` (the
receiving-side pattern each kit already implements for inbound calls
_from_ merqo) — same constant-time-compare logic, mirrored here for the
first time in the opposite direction.

### `src/app/api/telegram/webhook/route.ts` (new)

Same shape as every kit's Phase A webhook: verify
`X-Telegram-Bot-Api-Secret-Token`, resolve `/start <token>` against
`telegram_link_tokens`, and on success: upsert `merqo.customers` on
`(vendor_id, telegram_chat_id)` (via a new `phone` OR `telegram_chat_id`
upsert path — a customer connecting this way has no phone yet, so this
is an insert keyed purely on `telegram_chat_id`, distinct from the
existing phone-keyed `upsert_customer` RPC used by Phase A's kit-side
sync), set `consent_given_at = now()`, set `pending_notify_ref` from the
token's `notify_ref`, delete the token.

### `src/app/api/merqo/customer-connect-token/route.ts` (new)

`POST`, gated by `customerNotifySecretOk`. Body: `{ vendor_id, kit_slug,
notify_ref }`. Generates a token (30-minute expiry), inserts
`telegram_link_tokens`, returns `{ token, deep_link: "https://t.me/<bot
username>?start=<token>" }`.

### `src/app/api/merqo/notify-customer/route.ts` (new)

`POST`, gated by `customerNotifySecretOk`. Body:
`{ vendor_id, message, notify_ref? , phone? }` — exactly one of
`notify_ref`/`phone` required (Zod `.refine`), two lookup modes for the two
kit shapes:

- **`notify_ref` mode** (qkit's "waiting" flow): looks up `merqo.customers`
  where `vendor_id` and `pending_notify_ref = notify_ref`; if found,
  `sendTelegramMessage`, then **clears** `pending_notify_ref` (single-use
  per notification — a future event for the same vendor/customer needs its
  own fresh `notify_ref` set via another connect-token round; matches the
  master doc's "transactional, not standing" framing).
- **`phone` mode** (loopkit's reuse-only flow — no connect-token round
  ever happened for this event, there's no `notify_ref` to match): looks
  up `merqo.customers` where `vendor_id`, `phone = phone`, and
  `telegram_chat_id is not null`; if found, `sendTelegramMessage`, and
  does **not** clear anything — this is reusing a standing connection, not
  consuming a single-use ref, so nothing here is single-use to begin with.

No-op (200, not an error) in either mode if no match — the calling kit's
own event (order ready, reward redeemed) must never fail because a
customer never connected.

## Testing

- `src/lib/telegram.test.ts`: same assertions as every other kit's own
  copy.
- `src/lib/customer-notify-auth.test.ts`: valid/missing/wrong secret.
- `src/app/api/telegram/webhook/route.test.ts`: valid token links + sets
  `consent_given_at`/`pending_notify_ref`, deletes the token;
  invalid/expired token rejected without writing.
- `src/app/api/merqo/customer-connect-token/route.test.ts`: 401 without
  the secret; valid body mints a token + correct deep-link URL.
- `src/app/api/merqo/notify-customer/route.test.ts`: 401 without the
  secret; 400 when both or neither of `notify_ref`/`phone` are given; a
  matching `pending_notify_ref` triggers `sendTelegramMessage` and clears
  the ref; a matching `phone` (with a linked `telegram_chat_id`) triggers
  `sendTelegramMessage` and does NOT clear anything; no match in either
  mode is a silent 200, not an error.
- Extend `supabase/tests/rls.test.sql`: RLS on both new tables/columns,
  no client access to either.

## Self-review

- No placeholders — every route has real, complete logic.
- The stated cross-kit-reuse limitation from the master doc is not
  re-litigated or silently "fixed" here — `pending_notify_ref` is
  explicitly single-use/transactional, matching the consent model's own
  scope (not a standing subscription, which would need its own separate
  consent reasoning).
- New architectural direction (kit → merqo HTTP) is named explicitly, not
  slipped in as if it were the existing pattern.

## Parent

[specs](README.md)
