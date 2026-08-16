-- merqo/supabase/migrations/0020_vendor_telegram.sql
-- Phase A2 of the cross-kit Telegram integration design (see
-- docs/superpowers/specs/2026-08-16-vendor-telegram-connect-design.md and
-- the master doc's "Phase A2" section): consolidates qkit's and loopkit's
-- own per-kit vendor-alert bots onto merqo's own bot (the same one Phase
-- B+D, 0019, already built for customers). Adds merqo.vendor_telegram —
-- a standing vendor↔chat link, one row per vendor — and a `kind`
-- discriminator on merqo.telegram_link_tokens so the same webhook's
-- /start handler can resolve either a customer-scoped or a vendor-scoped
-- token.

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
grant all on merqo.vendor_telegram to service_role;

-- `kind` discriminates the existing customer-scoped link token (0019,
-- single-use, `notify_ref`/`kit_slug` required) from the new vendor-scoped
-- one (persistent — there's no single order to scope a standing vendor
-- link to, only the mint-time `kit_slug` for bookkeeping, so both columns
-- widen to nullable). `default 'customer'` backfills every pre-existing
-- row correctly (the table had no other kind before this migration); both
-- new insert paths (customer-connect-token, vendor-connect-token) set
-- `kind` explicitly regardless.
alter table merqo.telegram_link_tokens
  add column kind text not null default 'customer'
    check (kind in ('customer', 'vendor')),
  alter column notify_ref drop not null,
  alter column kit_slug drop not null;
