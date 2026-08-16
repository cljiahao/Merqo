-- merqo/supabase/migrations/0019_customer_telegram.sql
-- Phase B+D of the cross-kit Telegram integration design (see
-- docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md and
-- the master doc's "Phase B + D" section): widens merqo.customers into a
-- Telegram-or-phone identity and adds the linking-token table for merqo's
-- own third Telegram bot (distinct from qkit's/loopkit's Phase A bots).

-- ── Widen merqo.customers (0018) — not a bolt-on ────────────────────────────
alter table merqo.customers
  add column telegram_chat_id  bigint,
  add column consent_given_at  timestamptz,
  add column pending_notify_ref text,
  alter column phone drop not null;

-- Surrogate PK replaces the old (vendor_id, phone) composite — phone alone
-- can no longer identify a row now that a Telegram-only customer has none.
alter table merqo.customers drop constraint merqo_customers_pkey;
alter table merqo.customers add column id uuid primary key default gen_random_uuid();

alter table merqo.customers add constraint customers_identity_check
  check (phone is not null or telegram_chat_id is not null);

-- Partial (not full) unique indexes: a null phone/telegram_chat_id must not
-- collide across every other customer that also has that field null.
create unique index customers_vendor_phone_idx
  on merqo.customers (vendor_id, phone) where phone is not null;
create unique index customers_vendor_telegram_idx
  on merqo.customers (vendor_id, telegram_chat_id) where telegram_chat_id is not null;

-- upsert_customer's original ON CONFLICT (vendor_id, phone) targeted the
-- dropped composite PK. It must now target customers_vendor_phone_idx
-- instead, which — being a partial index — requires the same WHERE
-- predicate restated on the ON CONFLICT clause itself (Postgres only
-- infers a partial unique index as an arbiter when the predicate is
-- explicit here; this is why this upsert stays a SECURITY DEFINER SQL
-- function rather than a plain PostgREST .upsert() call, which cannot
-- express that predicate). Body otherwise unchanged from 0018.
create or replace function merqo.upsert_customer(
  p_vendor_id uuid,
  p_phone text,
  p_name text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into merqo.customers (vendor_id, phone, name, first_seen_at, last_seen_at)
    values (p_vendor_id, p_phone, p_name, now(), now())
  on conflict (vendor_id, phone) where phone is not null do update set
    name = coalesce(excluded.name, merqo.customers.name),
    last_seen_at = excluded.last_seen_at;
end;
$$;

-- ── merqo.telegram_link_tokens ───────────────────────────────────────────────
-- Short-lived, single-use deep-link tokens minted by
-- POST /api/merqo/customer-connect-token, resolved + deleted by the webhook
-- route's /start handler. RLS enabled, zero policies — service-role only,
-- same shape as every other *_link_tokens table in this ecosystem's Phase A
-- work (e.g. qkit.telegram_link_tokens, 0076 in the qkit repo).
create table merqo.telegram_link_tokens (
  token         text primary key,
  vendor_id     uuid not null references auth.users(id) on delete cascade,
  kit_slug      text not null,
  notify_ref    text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

alter table merqo.telegram_link_tokens enable row level security;

-- No client (anon/authenticated) ever reads or writes this table — only the
-- service-role client, from the two new /api/merqo/* routes and the webhook
-- route. Unlike merqo.customers (reachable only via SECURITY DEFINER
-- functions), this table's own rows carry no per-row secret beyond the
-- token itself, so a direct table grant is fine — same reasoning
-- 0012_service_role_table_grants.sql already established for other
-- service-role-only tables, restated here because 0012 predates this table
-- and its own blanket grant only covered tables that existed at the time.
grant all on merqo.telegram_link_tokens to service_role;

-- ── New customers-table access paths for Telegram identity ─────────────────
-- merqo.customers keeps its established zero-grant-to-anyone shape (0018:
-- "RLS enabled with zero policies and no table-level grant to anyone —
-- reachable only through their SECURITY DEFINER functions"). These three
-- functions are the Telegram-side counterparts to upsert_customer above,
-- all service-role-only (no kit/vendor session is ever present on these
-- call paths — the webhook has no session at all, and the two /api/merqo/*
-- routes authenticate via customerNotifySecretOk, not a Supabase session).

-- Links a Telegram chat to a customer row keyed purely on
-- (vendor_id, telegram_chat_id) — the counterpart to upsert_customer's
-- phone-keyed path for a customer who has no phone number yet. Called by
-- the webhook route's /start handler once a valid, unexpired link token is
-- resolved. Re-running /start against an already-linked chat refreshes
-- consent_given_at and overwrites pending_notify_ref with whatever the new
-- token carried (a customer can connect again for a later order).
create or replace function merqo.upsert_customer_telegram(
  p_vendor_id uuid,
  p_telegram_chat_id bigint,
  p_notify_ref text default null
) returns merqo.customers
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.customers;
begin
  insert into merqo.customers (vendor_id, telegram_chat_id, consent_given_at, pending_notify_ref)
    values (p_vendor_id, p_telegram_chat_id, now(), p_notify_ref)
  on conflict (vendor_id, telegram_chat_id) where telegram_chat_id is not null do update set
    consent_given_at = now(),
    pending_notify_ref = excluded.pending_notify_ref
  returning * into v_row;
  return v_row;
end;
$$;

-- notify-customer's notify_ref lookup mode (qkit's "waiting" flow):
-- atomically finds the customer with a matching pending_notify_ref for this
-- vendor and clears it in the same statement — single-use, and atomic so a
-- concurrent duplicate notify-customer call for the same ref can't both
-- observe a match (UPDATE's row lock serializes them; the second sees no
-- matching row once the first has cleared it). Returns the linked chat_id,
-- or null if nothing matched.
create or replace function merqo.claim_customer_by_notify_ref(
  p_vendor_id uuid,
  p_notify_ref text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_chat_id bigint;
begin
  update merqo.customers
    set pending_notify_ref = null
    where vendor_id = p_vendor_id and pending_notify_ref = p_notify_ref
    returning telegram_chat_id into v_chat_id;
  return v_chat_id;
end;
$$;

-- notify-customer's phone lookup mode (loopkit's reuse-only flow, no
-- connect-token round ever happened for this event): finds a standing
-- linked chat_id for this vendor+phone. Never clears anything — reusing an
-- existing connection is not a single-use claim. Returns null if no phone
-- match, or if the phone matches but no Telegram chat is linked.
create or replace function merqo.find_customer_telegram_by_phone(
  p_vendor_id uuid,
  p_phone text
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_chat_id bigint;
begin
  select telegram_chat_id into v_chat_id
    from merqo.customers
    where vendor_id = p_vendor_id and phone = p_phone and telegram_chat_id is not null;
  return v_chat_id;
end;
$$;

grant execute on function merqo.upsert_customer_telegram(uuid, bigint, text) to service_role;
grant execute on function merqo.claim_customer_by_notify_ref(uuid, text) to service_role;
grant execute on function merqo.find_customer_telegram_by_phone(uuid, text) to service_role;
