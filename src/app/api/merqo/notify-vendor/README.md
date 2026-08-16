# notify-vendor

## Purpose

A kit calls this once its own vendor-facing event happens (order placed
for qkit, reward redeemed for loopkit) to fire a Telegram notification to
that vendor — the Phase A2 replacement for each kit's own now-retired
per-kit vendor-alert bot. No-ops (still `200`) when the vendor isn't
linked — the calling kit's own event must never fail because a vendor
never connected.

## Contents

- `route.ts` — `POST(request)`. `401`s without a valid
  `customerNotifySecretOk` bearer. Body (Zod): `{ vendor_id, message }`.
  Simpler than `../notify-customer/`: one lookup key (`vendor_id`), no
  dual mode, nothing to clear (a vendor's link is a standing connection,
  not a single-use ref). Looks up `merqo.vendor_telegram` by `vendor_id`
  directly (a plain `.select()` — that table grants `service_role` a
  direct table read, no RPC indirection needed); sends via
  `@/lib/telegram`'s `sendTelegramMessage` on a match, and returns
  `{ ok: true, sent: false }` (not an error) on no match OR a lookup
  error — never a hard failure the calling kit might retry aggressively.
- `route.test.ts` — mocks `@/lib/customer-notify-auth`, `@/lib/telegram`'s
  `sendTelegramMessage`, and `@/lib/supabase/server`'s
  `createServiceClient`; covers the 401 path, malformed-body 400, the
  matching-send case, the no-match silent-200 case, and a lookup-error
  silent-200 case.

## Connectivity

Called by a kit's own event-handling code (qkit's `placeOrder`, loopkit's
`redeemAction`), fire-and-forget — same never-blocks-the-real-action rule
as every other Telegram integration point in this ecosystem. Reads
`merqo.vendor_telegram` rows written by `../../telegram/webhook/route.ts`.

## Parent

[merqo](../README.md)
