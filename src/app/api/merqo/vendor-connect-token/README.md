# vendor-connect-token

## Purpose

A kit (qkit, loopkit) calls this once, from the vendor's own
profile/settings page, to mint a standing Telegram deep-link token — the
Phase A2 replacement for each kit's own now-retired per-kit vendor-alert
bot. Merqo's own profile page mints its own token directly instead of
calling this HTTP endpoint (same app as the route itself).

## Contents

- `route.ts` — `POST(request)`. `401`s without a valid
  `customerNotifySecretOk` bearer. Body (Zod): `{ vendor_id, kit_slug }` —
  no `notify_ref`, unlike `../customer-connect-token/`: a vendor's link is
  a standing connection, not scoped to one order/event. `400`s on a
  malformed body. On success, generates a token (`@/lib/telegram`'s
  `generateLinkToken`), inserts a `merqo.telegram_link_tokens` row with
  `kind: "vendor"` and a 30-minute `expires_at`, and returns
  `{ token, deep_link: "https://t.me/<TELEGRAM_BOT_USERNAME>?start=<token>" }`.
  `500`s (logged) if `TELEGRAM_BOT_USERNAME` isn't configured, or if the
  insert fails.
- `route.test.ts` — mocks `@/lib/customer-notify-auth`, `@/lib/telegram`'s
  `generateLinkToken`, and `@/lib/supabase/server`'s `createServiceClient`;
  covers the 401 path, the happy path (correct insert row shape including
  `kind: "vendor"`, the 30-minute expiry window, and the exact `deep_link`
  format), and both Zod-rejection shapes (missing field, wrong type) plus
  invalid JSON.

## Connectivity

Called by a kit's own server action/route (its profile/settings page),
never by a browser directly. The token it mints is resolved by
`../../telegram/webhook/route.ts`'s `/start` handler, which upserts
`merqo.vendor_telegram` for a `kind='vendor'` token.

## Parent

[merqo](../README.md)
