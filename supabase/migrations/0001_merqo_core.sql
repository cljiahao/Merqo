-- Merqo team identity (mirrors qkit admins pattern)
create table public.merqo_team (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Kit registry / catalog
create table public.products (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  name           text not null,
  status         text not null default 'coming_soon' check (status in ('live','coming_soon')),
  app_url        text,
  metrics_url    text,
  metrics_secret text,               -- server-only; never read by anon/client
  created_at     timestamptz not null default now()
);

-- Vendor identity <-> owned products, keyed by email (the cross-project link)
create table public.vendor_links (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  product_slug text not null references public.products(slug),
  status       text not null default 'waitlist' check (status in ('active','waitlist')),
  created_at   timestamptz not null default now(),
  unique (email, product_slug)
);

create index vendor_links_email_idx on public.vendor_links (email);

-- Team membership predicate (SECURITY DEFINER so RLS policies can call it)
create or replace function public.is_merqo_team(p_uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$ select exists (select 1 from public.merqo_team where user_id = p_uid); $$;

-- RLS: default-deny. All app reads/writes go through the server (service client),
-- which bypasses RLS; these policies only govern the anon/authed client.
alter table public.merqo_team   enable row level security;
alter table public.products     enable row level security;
alter table public.vendor_links enable row level security;

-- Team can see team + registry (metrics_secret still only ever read server-side).
create policy merqo_team_self_select on public.merqo_team
  for select using (public.is_merqo_team((select auth.uid())));

create policy products_team_select on public.products
  for select using (public.is_merqo_team((select auth.uid())));

-- A vendor may see only their own link rows (by their JWT email).
create policy vendor_links_own_select on public.vendor_links
  for select using (
    public.is_merqo_team((select auth.uid()))
    or email = (select auth.jwt() ->> 'email')
  );
