# telegram

## Purpose

The Telegram Bot API surface for merqo's own third Telegram bot (Phase
B+D of `docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md`)
— lets a customer connect once via a deep-link QR and receive
transactional order/reward notifications from any Merqo kit they interact
with. Distinct from qkit's and loopkit's own Phase A vendor-alert bots
(own BotFather registration, own token, own webhook).

## Contents

- `webhook/` — the single registered webhook route Telegram POSTs every
  `Update` to; see its own README.

## Connectivity

`webhook/route.ts` is called by Telegram's own servers, not by anything
inside merqo — see `docs/DEPLOY.md` for the one-time `setWebhook`
registration step. The link tokens it resolves are minted by
`../merqo/customer-connect-token/route.ts` (called by a kit, currently
qkit); the resulting `merqo.customers` row is what
`../merqo/notify-customer/route.ts` sends to.

## Parent

[api](../README.md)
