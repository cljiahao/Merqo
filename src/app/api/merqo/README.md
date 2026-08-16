# merqo

## Purpose

Bearer-secret endpoints `qkit` and `loopkit` call INTO merqo to run the
Telegram-connect flows: the customer flow (Phase B+D of
`docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md`)
and the vendor activity-alert flow (Phase A2 of
`docs/superpowers/specs/2026-08-16-vendor-telegram-connect-design.md`,
which consolidated each kit's own separate per-kit vendor-alert bot onto
this same shared bot). The first kit → merqo HTTP direction in this
codebase — every existing cross-kit call (metrics pull, vendor-provision)
flows merqo → kit; this is the reverse.

## Contents

- `customer-connect-token/` — mints a short-lived Telegram deep-link token
  for one customer-facing event; see its own README.
- `notify-customer/` — fires a Telegram notification for a customer who's
  already connected, once the underlying event happens; see its own
  README.
- `vendor-connect-token/` — mints a standing Telegram deep-link token for
  a vendor's own activity alerts; see its own README.
- `notify-vendor/` — fires a Telegram notification for a vendor who's
  already connected, once the underlying event happens; see its own
  README.

## Connectivity

All four routes are gated by `@/lib/customer-notify-auth`'s
`customerNotifySecretOk` — a constant-time comparison of
`Authorization: Bearer <MERQO_CUSTOMER_SECRET>`, the SAME shared secret
value known by merqo and every participating kit (not a per-kit-unique
key system; the name predates the vendor-facing routes — see that file's
own doc comment). `customer-connect-token`/`vendor-connect-token` write
`merqo.telegram_link_tokens` (discriminated by its `kind` column),
resolved by `../telegram/webhook/route.ts`'s `/start` handler.
`notify-customer` reads `merqo.customers` (via the
`claim_customer_by_notify_ref`/`find_customer_telegram_by_phone` RPCs);
`notify-vendor` reads `merqo.vendor_telegram` directly. Both notify routes
call `@/lib/telegram`'s `sendTelegramMessage`.

## Parent

[api](../README.md)
