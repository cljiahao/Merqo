# end-customer-notice

## Purpose

Public `/legal/end-customer-notice` page — a short, non-contractual
disclosure for the vendor's own end customers (who never sign anything
with Merqo). Linked from merqo's Telegram bot's customer `/start` reply
and its `/privacy` command.

## Contents

- `page.tsx` — one-line Server Component rendering `@merqo/ui`'s
  `LegalDocument` with `doc="end-customer-notice"`.

## Connectivity

Linked from `../../api/telegram/webhook/route.ts`'s customer-facing
`/start` confirmation and `/privacy` reply.

## Parent

[legal](../README.md)
