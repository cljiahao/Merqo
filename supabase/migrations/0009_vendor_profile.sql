-- merqo/supabase/migrations/0009_vendor_profile.sql
-- Shared vendor identity (stall name + social links), owned by merqo so
-- every kit reads/writes one copy instead of re-onboarding it per kit. See
-- docs/superpowers/specs/2026-07-16-shared-vendor-profile-design.md.

create table merqo.vendor_profile (
  vendor_id     uuid primary key,
  stall_name    text not null,
  social_links  jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS enabled with zero policies: default-deny for anon/authenticated,
-- same convention as merqo.kit_events (0008). No client queries this table
-- directly — only through the two SECURITY DEFINER functions below.
alter table merqo.vendor_profile enable row level security;

create or replace function merqo.get_or_create_vendor_profile(
  p_vendor_id uuid,
  p_default_stall_name text default null
) returns merqo.vendor_profile
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_profile;
begin
  -- ON CONFLICT DO UPDATE (no-op self-assignment) makes this atomic against a
  -- concurrent first-touch call with the same vendor_id — a plain
  -- select-then-insert would race and raise unique_violation on the loser.
  insert into merqo.vendor_profile (vendor_id, stall_name)
  values (p_vendor_id, coalesce(nullif(p_default_stall_name, ''), 'My Stall'))
  on conflict (vendor_id) do update set vendor_id = excluded.vendor_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function merqo.upsert_vendor_profile(
  p_vendor_id uuid,
  p_stall_name text,
  p_social_links jsonb default '{}'::jsonb
) returns merqo.vendor_profile
language plpgsql security definer set search_path = '' as $$
declare
  v_row merqo.vendor_profile;
begin
  insert into merqo.vendor_profile (vendor_id, stall_name, social_links, updated_at)
  values (p_vendor_id, p_stall_name, p_social_links, now())
  on conflict (vendor_id) do update
    set stall_name   = excluded.stall_name,
        social_links = excluded.social_links,
        updated_at   = now()
  returning * into v_row;
  return v_row;
end;
$$;

grant execute on function merqo.get_or_create_vendor_profile(uuid, text) to authenticated, service_role;
grant execute on function merqo.upsert_vendor_profile(uuid, text, jsonb) to authenticated, service_role;
