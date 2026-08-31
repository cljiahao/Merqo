-- merqo/supabase/migrations/0023_vendor_sync_state.sql
-- /dashboard is now open to every signed-in user (not just active vendors),
-- so syncVendorKits() — which fans an HTTP call out to every live kit — runs
-- on every dashboard render for everyone, including users with zero kits.
-- This table records when a given email last completed a sync so the helper
-- can skip the fan-out inside a short TTL. Written only by the service-role
-- client in src/lib/vendor-sync.ts; never read from a browser-reachable path,
-- so it follows the same RLS-on / zero-client-policy / service-role-only shape
-- as telegram_link_tokens (0019/0020).

create table merqo.vendor_sync_state (
  email          text primary key,
  last_synced_at timestamptz not null default now()
);

alter table merqo.vendor_sync_state enable row level security;

grant select, insert, update on merqo.vendor_sync_state to service_role;
