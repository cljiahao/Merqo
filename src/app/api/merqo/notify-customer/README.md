# notify-customer

## Purpose

A kit calls this once its own event happens (order ready for qkit, reward
redeemed for loopkit) to fire a Telegram notification to a customer who's
already connected. No-ops (still `200`) when no connection matches — the
calling kit's own event must never fail because a customer never
connected.

## Contents

- `route.ts` — `POST(request)`. `401`s without a valid
  `customerNotifySecretOk` bearer. Body (Zod, `.refine`-checked):
  `{ vendor_id, message, notify_ref? , phone? }` — exactly one of
  `notify_ref`/`phone` required, `400`s if both or neither are present.
  **`notify_ref` mode** (qkit's "waiting" flow — a connect-token round
  already minted this exact ref): calls the `merqo.claim_customer_by_notify_ref`
  RPC, which atomically finds the customer with a matching
  `pending_notify_ref` for this vendor and clears it in the same
  statement (single-use). **`phone` mode** (loopkit's reuse-only flow — no
  connect-token round ever happened for this event): calls the
  `merqo.find_customer_telegram_by_phone` RPC, which looks up a standing
  linked `telegram_chat_id` for this vendor+phone and clears nothing —
  reusing an existing connection is not a single-use claim. Either mode
  sends via `@/lib/telegram`'s `sendTelegramMessage` on a match, and
  returns `{ ok: true, sent: false }` (not an error) on no match.
- `route.test.ts` — mocks `@/lib/customer-notify-auth`, `@/lib/telegram`'s
  `sendTelegramMessage`, and `@/lib/supabase/server`'s
  `createServiceClient`'s `.rpc()`; covers the 401 path, both malformed-body
  400s (both-present, neither-present), and — independently for each
  mode — the matching-send case and the no-match silent-200 case,
  asserting the `notify_ref` mode calls `claim_customer_by_notify_ref`
  (never `find_customer_telegram_by_phone`) and vice versa.

## Connectivity

Called by a kit's own event-handling code (qkit's `advanceOrder`'s
`ready` transition; loopkit's `redeemAction`), fire-and-forget — same
never-blocks-the-real-action rule as every other Telegram integration
point in this ecosystem. Reads `merqo.customers` rows written by
`../../telegram/webhook/route.ts`.

## Parent

[merqo](../README.md)
