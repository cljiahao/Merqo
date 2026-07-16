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
  -- Read-first fast path: the row exists on the overwhelming majority of
  -- calls (this is wired into qkit's dashboard load and a public
  -- customer-facing order-status page), so make that case a pure read
  -- instead of an unconditional write.
  select * into v_row from merqo.vendor_profile where vendor_id = p_vendor_id;
  if found then
    return v_row;
  end if;

  -- Only reached on a genuine first-touch race (the select above missed,
  -- then a concurrent caller inserted first). ON CONFLICT DO UPDATE (no-op
  -- self-assignment) makes this atomic against that race — a plain insert
  -- would raise unique_violation on the loser.
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
  -- SECURITY DEFINER bypasses RLS, so ownership must be checked in-body: a
  -- logged-in caller may only upsert their own vendor_id. A null auth.uid()
  -- (service-role / admin write path, which has no JWT subject) bypasses
  -- this — matches how service-role already bypasses RLS elsewhere.
  if auth.uid() is not null and auth.uid() <> p_vendor_id then
    raise exception 'not authorized to modify vendor_id %', p_vendor_id;
  end if;

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
