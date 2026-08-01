-- merqo/supabase/migrations/0016_merqo_dashboard_prefs.sql
-- Dashboard-tour "seen" state for Merqo's own /dashboard UI. A brand-new,
-- Merqo-dashboard-only table — deliberately NOT a column on
-- merqo.vendor_profile, which is a shared cross-kit table read/written by
-- qkit, paykit, etc. over HTTP/RPC; a vendor may have seen qkit's onboarding
-- tour without having seen Merqo's, so a Merqo-only UI flag doesn't belong on
-- a table other kits also own. See
-- docs/superpowers/specs/2026-08-01-dashboard-nav-standard-design.md
-- ("Standard 3: onboarding tour").
--
-- user_id references auth.users(id) directly (like merqo_team, unlike the
-- email-keyed vendor_links/vendor_profile) because a row only ever exists for
-- someone who has actually reached Merqo's own /dashboard, which
-- requireActiveVendor() already gates on a real Merqo auth session.

create table merqo.dashboard_prefs (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  tour_seen_at timestamptz
);

alter table merqo.dashboard_prefs enable row level security;

-- Owner-only: no team-sees-all override (unlike merqo_team/vendor_links/
-- vendor_feedback above) — this is purely personal UI state, not something a
-- team member has any reason to read or edit on someone else's behalf.
create policy dashboard_prefs_owner_select on merqo.dashboard_prefs
  for select using (user_id = (select auth.uid()));

create policy dashboard_prefs_owner_insert on merqo.dashboard_prefs
  for insert with check (user_id = (select auth.uid()));

create policy dashboard_prefs_owner_update on merqo.dashboard_prefs
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- markTourSeen() upserts through the RLS-scoped cookie client (a vendor's own
-- row never needs a service-role bypass), so `authenticated` needs the
-- table-level grants the policies above then filter down to the caller's row.
grant select, insert, update on merqo.dashboard_prefs to authenticated;
grant all on merqo.dashboard_prefs to service_role;
