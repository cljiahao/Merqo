# api

## Purpose

Route-handler API endpoints — the surface other systems (a sibling kit,
Telegram's own servers) hit over HTTP, as opposed to server actions used by
merqo's own pages.

## Contents

- `merqo/` — bearer-secret endpoints `qkit` and `loopkit` call INTO merqo
  to run the customer Telegram-connect flow. The first kit → merqo HTTP
  direction in this codebase — every other cross-kit call (metrics pull,
  vendor-provision) flows merqo → kit; see its own README.
- `telegram/` — merqo's own third Telegram bot's webhook (`webhook/route.ts`),
  distinct from qkit's and loopkit's own Phase A vendor-alert bots; see its
  own README.

## Connectivity

`merqo/` is machine-to-machine, secured by a shared-secret
`Authorization: Bearer <MERQO_CUSTOMER_SECRET>` header checked with a
constant-time comparison (`@/lib/customer-notify-auth`'s
`customerNotifySecretOk`) — this is merqo's first time being the
_receiving_ side of a bearer-authenticated call, mirroring the
`provisionBearerOk`-style guard each kit already implements for inbound
calls FROM merqo, now in the opposite direction.
`telegram/webhook` is authenticated differently — a constant-time
comparison of Telegram's own `X-Telegram-Bot-Api-Secret-Token` header
against `TELEGRAM_WEBHOOK_SECRET`, registered one-time via Telegram's
`setWebhook` API (see `docs/DEPLOY.md`), not a bearer header merqo issues
itself.

## Parent

[app](../README.md)
