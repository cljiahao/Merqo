-- merqo/supabase/migrations/0029_founder_telegram_alerts.sql
-- Cross-cutting friction fix: help/feedback submissions from any of the 6
-- kits already land in merqo.support_messages/vendor_feedback/feedback
-- (some via direct RPC, some via merqo's own RLS-gated insert), but nobody
-- proactively watches those tables. A trigger on all three tables fires
-- regardless of which write path landed the row, so this is the one place
-- that needs to change rather than touching every kit's own app code. Bot
-- token and chat id live in Supabase Vault, not this file, so no secret is
-- ever checked into git — see docs/DEPLOY.md for the one-time setup.

create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function merqo.notify_founder_telegram(p_text text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
  v_chat_id text;
begin
  select decrypted_secret into v_token
    from vault.decrypted_secrets where name = 'telegram_bot_token';
  select decrypted_secret into v_chat_id
    from vault.decrypted_secrets where name = 'merqo_founder_telegram_chat_id';

  -- Not configured yet (secrets not set in Vault) is a no-op, matching
  -- sendTelegramMessage's own missing-token no-op convention in the app layer.
  if v_token is null or v_chat_id is null then
    return;
  end if;

  perform net.http_post(
    url := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('chat_id', v_chat_id, 'text', p_text)
  );
end;
$$;

create or replace function merqo.trg_notify_founder_support()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform merqo.notify_founder_telegram(
    format(
      E'New help request (%s), category "%s":\n%s',
      coalesce(new.kit_slug, 'merqo'),
      new.category,
      new.body
    )
  );
  return new;
end;
$$;

create trigger support_messages_notify_founder
  after insert on merqo.support_messages
  for each row execute function merqo.trg_notify_founder_support();

create or replace function merqo.trg_notify_founder_vendor_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform merqo.notify_founder_telegram(
    format(
      E'New feedback on %s, NPS %s%s',
      new.kit_slug,
      new.nps,
      case when new.message is null then '' else E':\n' || new.message end
    )
  );
  return new;
end;
$$;

create trigger vendor_feedback_notify_founder
  after insert on merqo.vendor_feedback
  for each row execute function merqo.trg_notify_founder_vendor_feedback();

create or replace function merqo.trg_notify_founder_hub_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform merqo.notify_founder_telegram(
    format(
      E'New feedback on Merqo hub, NPS %s%s',
      new.nps,
      case when new.message is null then '' else E':\n' || new.message end
    )
  );
  return new;
end;
$$;

create trigger feedback_notify_founder
  after insert on merqo.feedback
  for each row execute function merqo.trg_notify_founder_hub_feedback();
