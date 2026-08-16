# Vendor Telegram Connect (Phase A2) — Design

**Date:** 2026-08-16
**Status:** Approved; plan to follow.

## Summary

merqo's half of `Merqo Business/docs/business/2026-08-16-telegram-
integration-design.md`'s Phase A2 — consolidates Phase A's vendor activity
alerts (qkit's order alerts, loopkit's reward alerts) off their own
separate per-kit bots and onto merqo's own bot (the same one
`2026-08-16-customer-telegram-connect-design.md` already built for
customers). **Read the master doc's "Phase A2" section in full first** —
why this supersedes Phase A, and the real "every already-linked vendor
must reconnect once" consequence, are decided there.

## Guiding decisions

- **Reuses the existing bot/webhook**, not a second merqo bot. One
  `TELEGRAM_BOT_TOKEN` already exists (Phase B+D); this phase adds a
  second _kind_ of link that same bot's webhook resolves.
- **`vendor_id` is the shared `auth.users.id` every kit already keys
  on** — no widened-identity substrate needed here, unlike Phase B+D's
  `merqo.customers` (a customer has no merqo account; a vendor already
  does, via the shared `.merqo.io` SSO session). A plain `vendor_id`
  primary key is enough.
- **`merqo.telegram_link_tokens` gets a `kind` column**, not a second
  table — `'customer'` (existing, order-scoped, single-use,
  `notify_ref`/`kit_slug` required) or `'vendor'` (new, persistent,
  `notify_ref`/`kit_slug` nullable — there's no single order to scope a
  standing vendor link to, only the mint-time `kit_slug` for bookkeeping).
- **`notify-vendor` is simpler than `notify-customer`** — one lookup key
  (`vendor_id`), no dual mode, nothing to clear (a vendor's link is a
  standing connection, not a single-use ref).
- **No data migration path for already-linked vendors** — Telegram's
  `chat_id` is scoped to a (bot, user) pair, so a vendor's old `chat_id`
  under qkit's/loopkit's retired bots is meaningless under merqo's bot.
  They see the connect flow again next time they visit their profile
  settings, same first-time experience as a vendor who never linked.

## What changes

### `supabase/migrations/0020_vendor_telegram.sql` (new)

```sql
create table merqo.vendor_telegram (
  vendor_id  uuid primary key references auth.users(id) on delete cascade,
  chat_id    bigint not null,
  linked_at  timestamptz not null default now()
);

alter table merqo.vendor_telegram enable row level security;

create policy vendor_telegram_own on merqo.vendor_telegram
  for select using (vendor_id = (select auth.uid()));

grant select on merqo.vendor_telegram to authenticated;
-- Writes only via the service-role client (the webhook route on link, a
-- disconnect action) — same shape as every kit's own now-retired copy of
-- this exact table.

alter table merqo.telegram_link_tokens
  add column kind text not null default 'customer'
    check (kind in ('customer', 'vendor')),
  alter column notify_ref drop not null,
  alter column kit_slug drop not null;
-- default 'customer' backfills every pre-existing row correctly (the
-- table had no other kind until this migration); the column is NOT NULL
-- with no default going forward — every new insert must pick a kind
-- explicitly.
```

### `src/app/api/telegram/webhook/route.ts` (extend)

The `/start <token>` handler branches on the resolved token's `kind`:
`'customer'` keeps its existing `merqo.customers` upsert path unchanged;
`'vendor'` upserts `merqo.vendor_telegram` on `(vendor_id, chat_id)`
instead — no `consent_given_at`/`pending_notify_ref` involved (that's
customer-consent bookkeeping, not applicable to a vendor's own alert
connection to their own account).

### `src/app/api/merqo/vendor-connect-token/route.ts` (new)

`POST`, gated by `customerNotifySecretOk` (same bearer secret, same trust
boundary as the customer endpoints — a kit calling merqo either way).
Body: `{ vendor_id, kit_slug }`. Mints a `kind='vendor'` token (30-minute
expiry, same as the customer flow), inserts `telegram_link_tokens`,
returns `{ token, deep_link }`.

### `src/app/api/merqo/notify-vendor/route.ts` (new)

`POST`, gated by `customerNotifySecretOk`. Body: `{ vendor_id, message }`.
Looks up `merqo.vendor_telegram` by `vendor_id`; if found,
`sendTelegramMessage`; no-op (200) if not linked.

### merqo's own profile-settings UI

A new `@merqo/ui` component (single-column layout, not the two-column
`TwoColumnSections` shape the rest of the profile page may use elsewhere
— this is a narrow settings block) rendered on merqo's own
`src/app/profile/` page. Unlike qkit's/loopkit's kit-side components
(which have to call merqo over HTTP), this one lives inside merqo itself:
mints its own connect token directly (no HTTP hop — it's the same app as
the endpoint above) and reads `merqo.vendor_telegram` directly for
connected/disconnected state. Exposed from `@merqo/ui` per the explicit
instruction to keep it there rather than merqo-local, even though (for
now) merqo's own profile page is its only consumer.

### `src/lib/customer-notify-auth.ts` → rename consideration

`customerNotifySecretOk` now also gates two vendor-facing endpoints, not
just customer ones. Rename to something like `kitCallerSecretOk` if it
reads confusingly once both live side by side — implementer's call at
build time, not a hard requirement of this spec (the underlying secret,
`MERQO_CUSTOMER_SECRET`, keeps its existing name either way — renaming
env vars this late has a real coordination cost across 3 repos, not worth
it for a naming nicety).

## Testing

- `src/app/api/telegram/webhook/route.test.ts` (extend): a `kind='vendor'`
  token upserts `vendor_telegram`, not `customers`; a `kind='customer'`
  token still behaves exactly as before (regression coverage).
- `src/app/api/merqo/vendor-connect-token/route.test.ts`: 401 without the
  secret; valid body mints a `kind='vendor'` token + correct deep-link.
- `src/app/api/merqo/notify-vendor/route.test.ts`: 401 without the
  secret; a matching `vendor_id` sends; no match is a silent 200.
- New profile-settings component test (in `merqo-ui`): renders
  disconnected/connected states, connect action mints a token.
- Extend `supabase/tests/rls.test.sql`: RLS on `merqo.vendor_telegram`
  (own-row select only, no client write grant).

## Self-review

- No placeholders.
- The "every already-linked vendor must reconnect" consequence is stated
  here, matching the master doc — not silently treated as a seamless
  migration.
- `merqo.telegram_link_tokens`'s widened `kind` column is backfilled
  correctly for every pre-existing (customer-only) row via the migration's
  `default 'customer'`, not left ambiguous.

## Parent

[specs](README.md)
