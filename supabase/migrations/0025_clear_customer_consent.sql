-- merqo/supabase/migrations/0025_clear_customer_consent.sql
-- End-customer consent withdrawal via the Telegram bot's /stop command
-- (docs/superpowers/specs/2026-09-04-merqo-legal-docs-design.md — the
-- retention schedule names "consent withdrawn" as a real state for
-- merqo.customers, and Task 13 wires the /stop command that reaches it).
--
-- merqo.customers has no table-level write grant to anyone (0018: "no
-- client queries this table directly, only through the RPC"; 0019 restated
-- it) — every write is a SECURITY DEFINER RPC. So /stop clears consent
-- through this function, not a direct UPDATE from the service client.
--
-- Keyed on telegram_chat_id alone: one chat can be linked under several
-- vendors, and /stop opts the person out of this bot's transactional
-- messages from all of them at once. pending_notify_ref is cleared in the
-- same statement so an already-queued "order ready" notify can't still
-- land after the opt-out. A no-op (zero rows) when the chat was never
-- connected — the webhook replies the same either way, never an error.

create or replace function merqo.clear_customer_consent_by_telegram(
  p_telegram_chat_id bigint
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update merqo.customers
    set consent_given_at = null,
        pending_notify_ref = null
    where telegram_chat_id = p_telegram_chat_id;
end;
$$;

grant execute on function merqo.clear_customer_consent_by_telegram(bigint) to service_role;

-- Same PUBLIC-execute gap the three 0019 functions close explicitly:
-- Postgres grants EXECUTE to PUBLIC by default, so without this revoke
-- anon/authenticated could call it over PostgREST's RPC endpoint and clear
-- any chat's consent by enumerating chat ids.
revoke execute on function merqo.clear_customer_consent_by_telegram(bigint) from public;
