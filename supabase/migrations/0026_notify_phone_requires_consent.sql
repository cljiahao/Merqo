-- merqo/supabase/migrations/0026_notify_phone_requires_consent.sql
-- /stop (0025) clears consent_given_at, but notify-customer's phone lookup
-- mode resolved a chat_id purely on (vendor_id, phone, telegram_chat_id is
-- not null) — it never checked consent. So after a customer /stop'd, a
-- later loopkit reward notify (which uses the phone path) still resolved
-- their chat_id and sent. Redefines 0019's find_customer_telegram_by_phone
-- with the one missing guard so /stop stops BOTH notify paths (the
-- notify_ref path already stopped — /stop also clears pending_notify_ref).
--
-- Safe: a customer who connected Telegram always has consent_given_at set
-- (every /start connect sets it via upsert_customer_telegram), and a
-- phone-only customer who never connected has telegram_chat_id null
-- (already excluded by the existing filter). The guard only newly-excludes
-- a customer who connected and then /stop'd — exactly the intent.

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
    where vendor_id = p_vendor_id and phone = p_phone
      and telegram_chat_id is not null and consent_given_at is not null;
  return v_chat_id;
end;
$$;

-- Same service-role-only, PUBLIC-execute-revoked shape as 0019's original
-- definition (create or replace preserves existing grants, but restated
-- here to match 0019's convention and stay correct if run against a fresh
-- database where this migration lands before any prior grant).
grant execute on function merqo.find_customer_telegram_by_phone(uuid, text) to service_role;
revoke execute on function merqo.find_customer_telegram_by_phone(uuid, text) from public;
