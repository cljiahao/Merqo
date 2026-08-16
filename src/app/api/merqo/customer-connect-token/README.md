# customer-connect-token

## Purpose

A kit (currently qkit's order-status "waiting" page) calls this to mint a
short-lived Telegram deep-link token for one customer-facing event, and
renders the returned `deep_link` as a QR/button.

## Contents

- `route.ts` — `POST(request)`. `401`s without a valid
  `customerNotifySecretOk` bearer. Body (Zod): `{ vendor_id, kit_slug,
notify_ref }` — `notify_ref` is an opaque, kit-chosen string (e.g.
  `"qkit:<order_id>"`) merqo never interprets, only stores and later
  echoes back to `notify-customer`'s `notify_ref` lookup mode. `400`s on a
  malformed body. On success, generates a token (`@/lib/telegram`'s
  `generateLinkToken`), inserts a `merqo.telegram_link_tokens` row with a
  30-minute `expires_at`, and returns
  `{ token, deep_link: "https://t.me/<TELEGRAM_BOT_USERNAME>?start=<token>" }`.
  `500`s (logged) if `TELEGRAM_BOT_USERNAME` isn't configured, or if the
  insert fails.
- `route.test.ts` — mocks `@/lib/customer-notify-auth`, `@/lib/telegram`'s
  `generateLinkToken`, and `@/lib/supabase/server`'s `createServiceClient`;
  covers the 401 path, the happy path (correct insert row shape, the
  30-minute expiry window, and the exact `deep_link` format), and both
  Zod-rejection shapes (missing field, wrong type) plus invalid JSON.

## Connectivity

Called by a kit's own server action/route (currently qkit's order-status
page), never by a browser directly. The token it mints is resolved by
`../../telegram/webhook/route.ts`'s `/start` handler.

## Parent

[merqo](../README.md)
