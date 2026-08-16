# webhook

## Purpose

The single HTTPS endpoint registered with Telegram (`setWebhook`) for
merqo's own bot — every `Update` Telegram sends lands here. Currently
handles only account linking (`/start <token>`); everything else is
silently ignored. Since Phase A2 (0020), that one bot serves two link
kinds: the original customer-facing connect flow (Phase B+D) and the
vendor-facing activity-alert connect flow consolidated off qkit's/
loopkit's own retired per-kit bots.

## Contents

- `route.ts` — `POST(request)`. Verifies `X-Telegram-Bot-Api-Secret-Token`
  against `TELEGRAM_WEBHOOK_SECRET` with a constant-time comparison
  (`timingSafeEqual`) before touching any data — `401` on a missing or
  wrong header, fails closed if the secret itself isn't configured. Parses
  the body as a Telegram `Update` (Zod, only the `message.text`/`chat.id`
  shape this route actually reads); a `/start <token>` message resolves the
  token against `merqo.telegram_link_tokens` (service-role — that table
  has no client-read policy at all), silently no-ops on a missing/expired
  token, otherwise branches on the token's `kind` column (0020): `'customer'`
  links via the `merqo.upsert_customer_telegram` RPC (a distinct insert path
  from the phone-keyed `upsert_customer` RPC — a customer connecting this
  way has no phone yet); `'vendor'` links via a plain `.upsert()` onto
  `merqo.vendor_telegram` (that table grants `service_role` a direct table
  write, no RPC indirection needed), keyed on its own `vendor_id` primary
  key. Either branch deletes the now-used token and sends a
  kind-appropriate confirmation message back. Always responds `200` to any
  Telegram-shaped payload regardless of internal outcome — Telegram retries
  aggressively on a non-2xx, so every internal failure is logged, never
  surfaced as a webhook error. A malformed (non-JSON) body also gets a
  `200` rather than a `400`, for the same reason.
- `route.test.ts` — mocks `@/lib/supabase/server`'s `createServiceClient`
  (including its `.rpc()` call and the `vendor_telegram` table's
  `.upsert()`) and `@/lib/telegram`'s `sendTelegramMessage`; covers the
  missing/wrong/unset-secret 401 paths, the happy-path link for both
  `kind='customer'` (RPC upsert) and `kind='vendor'` (table upsert) —
  each asserting the OTHER path was never touched — token delete +
  confirmation send, expired-token and unknown-token no-ops, a non-`/start`
  message, an internal lookup throw, and a malformed JSON body — all still
  responding `200` except the three 401 cases.

## Connectivity

Reached only by Telegram's own servers, once registered via `setWebhook`
(`docs/DEPLOY.md`) — this repo never calls it itself. `src/proxy.ts`'s
auth-gate matcher (`isProtectedPath` in `src/lib/supabase/middleware.ts`)
only protects `/admin` and `/dashboard`, so this route already passes
through untouched; no exclusion was needed. Resolves tokens written by
`../../merqo/customer-connect-token/route.ts` and
`../../merqo/vendor-connect-token/route.ts`; writes the `merqo.customers`
row that `../../merqo/notify-customer/route.ts` later sends to, or the
`merqo.vendor_telegram` row that `../../merqo/notify-vendor/route.ts`
later sends to.

## Parent

[telegram](../README.md)
