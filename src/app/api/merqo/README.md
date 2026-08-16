# merqo

## Purpose

Bearer-secret endpoints `qkit` and `loopkit` call INTO merqo to run the
customer Telegram-connect flow (Phase B+D of
`docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md`).
The first kit → merqo HTTP direction in this codebase — every existing
cross-kit call (metrics pull, vendor-provision) flows merqo → kit; this is
the reverse.

## Contents

- `customer-connect-token/` — mints a short-lived Telegram deep-link token
  for one customer-facing event; see its own README.
- `notify-customer/` — fires a Telegram notification for a customer who's
  already connected, once the underlying event happens; see its own
  README.

## Connectivity

Both routes are gated by `@/lib/customer-notify-auth`'s
`customerNotifySecretOk` — a constant-time comparison of
`Authorization: Bearer <MERQO_CUSTOMER_SECRET>`, the SAME shared secret
value known by merqo and every participating kit (not a per-kit-unique
key system). `customer-connect-token` writes `merqo.telegram_link_tokens`,
resolved by `../telegram/webhook/route.ts`'s `/start` handler.
`notify-customer` reads `merqo.customers` (via the
`claim_customer_by_notify_ref`/`find_customer_telegram_by_phone` RPCs) and
calls `@/lib/telegram`'s `sendTelegramMessage`.

## Parent

[api](../README.md)
