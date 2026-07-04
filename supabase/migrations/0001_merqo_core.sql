-- Merqo lives in the SHARED Supabase project (one project, schema per kit —
-- arch-v2 §2). qkit owns `public.*`; merqo owns `merqo.*`. Cross-kit reads still
-- go over the HTTP metrics API (arch-v2 §6), never a direct cross-schema query.
--
-- PROVISIONING: `merqo` must be added to the project's exposed API schemas
-- (Supabase dashboard → API settings → Exposed schemas, or the CLI project's
-- [api] schemas list) or supabase-js requests to it return PGRST106.

create schema if not exists merqo;

-- Merqo team identity (mirrors qkit's admins pattern)
create table merqo.merqo_team (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Kit registry / catalog
create table merqo.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  status         text not null default 'coming_soon' check (status in ('live','coming_soon')),
  app_url        text,
  metrics_url    text,
  metrics_secret text,               -- server-only; never read by anon/client
  created_at     timestamptz not null default now()
);

-- Vendor identity <-> owned products, keyed by (lowercased) email
create table merqo.vendor_links (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  product_slug text not null references merqo.products(slug),
  status       text not null default 'waitlist' check (status in ('active','waitlist')),
  created_at   timestamptz not null default now(),
  unique (email, product_slug)
);

create index vendor_links_email_idx on merqo.vendor_links (email);

-- Team membership predicate (SECURITY DEFINER so RLS policies can call it).
-- search_path pinned empty + fully-qualified refs to prevent search-path hijack.
create or replace function merqo.is_merqo_team(p_uid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$ select exists (select 1 from merqo.merqo_team where user_id = p_uid); $$;

-- RLS: default-deny. Reads run either as the authenticated cookie client (team
-- membership check, gated by RLS below) or the service client (bypasses RLS).
alter table merqo.merqo_team   enable row level security;
alter table merqo.products     enable row level security;
alter table merqo.vendor_links enable row level security;

create policy merqo_team_self_select on merqo.merqo_team
  for select using (merqo.is_merqo_team((select auth.uid())));

create policy products_team_select on merqo.products
  for select using (merqo.is_merqo_team((select auth.uid())));

-- A vendor may see only their own link rows (by their JWT email); team sees all.
create policy vendor_links_own_select on merqo.vendor_links
  for select using (
    merqo.is_merqo_team((select auth.uid()))
    or email = (select auth.jwt() ->> 'email')
  );

-- ── Data-API grants (auto-expose is unreliable across CLI versions; be explicit).
grant usage on schema merqo to anon, authenticated, service_role;

-- authenticated: ONLY the team-membership check runs through the cookie client,
-- so grant SELECT on merqo_team only. products/vendor_links are read exclusively
-- via the service client — withholding the grant keeps metrics_secret off every
-- browser-reachable path (RLS alone would still expose the column to a team
-- member's own client). Add a scoped grant here if a client-side read is ever
-- introduced (and revoke the metrics_secret column then).
grant select on merqo.merqo_team to authenticated;

-- service_role: the trusted server role (bypasses RLS) — every merqo write and
-- the metrics reads run through it.
grant all on all tables in schema merqo to service_role;
grant all on all sequences in schema merqo to service_role;

-- The predicate must be executable by the roles whose RLS policies call it.
grant execute on function merqo.is_merqo_team(uuid) to anon, authenticated, service_role;
