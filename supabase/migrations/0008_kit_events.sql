-- merqo/supabase/migrations/0008_kit_events.sql
-- Thin cross-kit signal log — NOT a shared data store. Each kit keeps its own
-- domain data in its own schema; this table carries only a pointer ("this
-- event happened, here's the vendor and a small payload") so a kit can verify
-- another kit's event without an HTTP round-trip (they already share one
-- Postgres instance). See docs/superpowers/specs/2026-07-13-qkit-loopkit-
-- auto-award-design.md §4.1.

create table merqo.kit_events (
  id         uuid primary key default gen_random_uuid(),
  vendor_id  uuid not null,
  kit_name   text not null,
  event_type text not null,
  event_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index kit_events_vendor_idx on merqo.kit_events (vendor_id, created_at desc);
create index kit_events_type_idx on merqo.kit_events (event_type);

-- RLS enabled with zero policies: default-deny for anon/authenticated
-- regardless of any inherited default-privilege grant on this schema.
-- service_role bypasses RLS as usual; the SECURITY DEFINER functions below
-- (and Task 4's loopkit-side readers) execute as the function owner, also
-- unaffected by RLS on this table. No client ever queries this table
-- directly — only through emit_metric (write) or a SECURITY DEFINER reader
-- (read) — so no policy is ever needed here.
alter table merqo.kit_events enable row level security;

-- Single controlled write path — no kit gets a blanket grant on the table
-- itself; only server-side kit code with a service-role/authenticated
-- Postgres role may emit an event via this function, never a direct table
-- write from a customer-facing browser context.
create or replace function merqo.emit_metric(
  p_vendor_id  uuid,
  p_kit_name   text,
  p_event_type text,
  p_event_data jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  insert into merqo.kit_events (vendor_id, kit_name, event_type, event_data)
  values (p_vendor_id, p_kit_name, p_event_type, p_event_data)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function merqo.emit_metric(uuid, text, text, jsonb) to authenticated, service_role;
