-- Customer sync is a trusted backend/owner-trigger operation, never a browser RPC.
revoke execute on function merqo.upsert_customer(uuid, text, text)
  from public, anon, authenticated;
grant execute on function merqo.upsert_customer(uuid, text, text) to service_role;

-- Founder notifications may only run through their owning database triggers.
revoke execute on function merqo.notify_founder_telegram(text)
  from public, anon, authenticated, service_role;
revoke execute on function merqo.trg_notify_founder_support()
  from public, anon, authenticated, service_role;
revoke execute on function merqo.trg_notify_founder_vendor_feedback()
  from public, anon, authenticated, service_role;
revoke execute on function merqo.trg_notify_founder_hub_feedback()
  from public, anon, authenticated, service_role;

-- This singleton was created after the blanket service-role grants in 0012.
grant select, update on merqo.billing_settings to service_role;
