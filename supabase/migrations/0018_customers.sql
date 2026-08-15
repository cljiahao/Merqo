-- Shared cross-kit customer identity, keyed on (vendor_id, phone) - mirrors
-- loopkit.customers' own proven shape exactly. Closes the biggest gap
-- flagged by 2026-07-28-cross-kit-integration-and-retention-research.md:
-- only vendor identity was shared across kits before this, not customer
-- identity. See
-- docs/business/2026-08-16-cross-kit-customer-identity-design.md.

create table merqo.customers (
  vendor_id      uuid not null references auth.users(id) on delete cascade,
  phone          text not null,
  name           text,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (vendor_id, phone)
);

-- RLS enabled, zero policies (same convention as vendor_profile/kit_events)
-- - no client queries this table directly, only through the RPC below.
alter table merqo.customers enable row level security;

create or replace function merqo.upsert_customer(
  p_vendor_id uuid,
  p_phone text,
  p_name text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into merqo.customers (vendor_id, phone, name, first_seen_at, last_seen_at)
    values (p_vendor_id, p_phone, p_name, now(), now())
  on conflict (vendor_id, phone) do update set
    name = coalesce(excluded.name, merqo.customers.name),
    last_seen_at = excluded.last_seen_at;
end;
$$;

grant execute on function merqo.upsert_customer(uuid, text, text) to authenticated, service_role;
