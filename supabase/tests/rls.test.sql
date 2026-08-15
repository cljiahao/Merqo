-- merqo/supabase/tests/rls.test.sql
-- RLS isolation — pgTAP, run with `supabase test db`.
-- Covers merqo's seven RLS-bearing tables: merqo_team (team-membership gates
-- visibility of the WHOLE table, not just the caller's own row — see the
-- comment below), products (RLS is a backstop only; `authenticated` has no
-- table-level grant at all, so metrics_secret never reaches a browser-reachable
-- path per migration 0001/0003), vendor_links (own-email select + team-sees-all),
-- kit_events and vendor_profile (0008/0009: RLS enabled with zero policies and
-- no table-level grant to anyone — reachable only through their SECURITY
-- DEFINER functions), vendor_feedback (0011: team-select policy + grant,
-- writes only via submit_vendor_feedback), billing_settings (0017:
-- public-read singleton, no UPDATE grant to any client role).
-- Runs in ONE rolled-back transaction with inline fixed-UUID fixtures.

begin;
select plan(42);

-- ── Fixtures (created under the default/superuser test role → RLS + grants
-- are bypassed here) ─────────────────────────────────────────────────────────
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'team-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vendor-b@test.local');

insert into merqo.merqo_team (user_id)
values ('00000000-0000-0000-0000-00000000000a');

insert into merqo.products (id, slug, name, status)
values ('00000000-0000-0000-0000-0000000c0001', 'qkit-rlstest', 'qkit', 'live');

insert into merqo.vendor_links (id, email, product_slug, status)
values
  ('00000000-0000-0000-0000-0000000e0001', 'vendor-b@test.local', 'qkit-rlstest', 'active'),
  ('00000000-0000-0000-0000-0000000e0002', 'someone-else@test.local', 'qkit-rlstest', 'waitlist');

insert into merqo.kit_events (id, vendor_id, kit_name, event_type, event_data)
values ('00000000-0000-0000-0000-0000000f0001', '00000000-0000-0000-0000-00000000000b', 'qkit', 'test_event', '{}');

insert into merqo.vendor_profile (vendor_id, stall_name)
values ('00000000-0000-0000-0000-00000000000b', 'Vendor B Stall');

insert into merqo.vendor_feedback (id, kit_slug, vendor_id, nps, message)
values ('00000000-0000-0000-0000-000000100001', 'qkit-rlstest', '00000000-0000-0000-0000-00000000000b', 8, 'great kit');

-- A third user with no dashboard_prefs row at all — used only to prove a
-- non-owner insert is rejected without also tripping a primary-key conflict.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000c',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'vendor-c@test.local');

insert into merqo.dashboard_prefs (user_id, tour_seen_at)
values ('00000000-0000-0000-0000-00000000000b', now());

-- ── RLS is actually enabled on every protected table ─────────────────────────
select ok((select relrowsecurity from pg_class where oid = 'merqo.merqo_team'::regclass), 'RLS on merqo_team');
select ok((select relrowsecurity from pg_class where oid = 'merqo.products'::regclass), 'RLS on products');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_links'::regclass), 'RLS on vendor_links');
select ok((select relrowsecurity from pg_class where oid = 'merqo.kit_events'::regclass), 'RLS on kit_events');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_profile'::regclass), 'RLS on vendor_profile');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_feedback'::regclass), 'RLS on vendor_feedback');
select ok((select relrowsecurity from pg_class where oid = 'merqo.dashboard_prefs'::regclass), 'RLS on dashboard_prefs');

-- ── Act as a team member ─────────────────────────────────────────────────────
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000a', 'role', 'authenticated', 'email', 'team-a@test.local')::text,
  true);

-- merqo_team_self_select's USING clause is `merqo.is_merqo_team((select auth.uid()))`
-- — a predicate that does not reference the row at all, so it evaluates to the
-- SAME value for every row. A team member therefore sees the WHOLE table (not
-- just their own row, despite the policy's name), and a non-team caller sees
-- none of it. `authenticated` has `grant select` (0001), so this is a plain
-- RLS filter, not a privilege error.
select isnt_empty(
  $$ select 1 from merqo.merqo_team where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'team member reads merqo_team');

-- products has NO grant to `authenticated` at all — not even for team members.
-- 0001's own comment is explicit: "products/vendor_links are read exclusively
-- via the service client — withholding the grant keeps metrics_secret off
-- every browser-reachable path (RLS alone would still expose the column to a
-- team member's own client)." Table-level privilege is checked before RLS, so
-- ANY direct select as `authenticated` — team member or not — raises
-- permission-denied (42501); it does not filter to a row or an empty set.
select throws_ok(
  $$ select 1 from merqo.products where id = '00000000-0000-0000-0000-0000000c0001' $$,
  '42501', null,
  'team member cannot SELECT products directly (no grant; metrics_secret stays server-only)');

-- vendor_links_own_select (0003) is `is_merqo_team(...) OR lower(email) = lower(jwt email)`
-- — the team branch passes regardless of row, so a team member sees every row,
-- including one belonging to a different vendor's email.
select isnt_empty(
  $$ select 1 from merqo.vendor_links where id = '00000000-0000-0000-0000-0000000e0002' $$,
  'team member reads any vendor_links row (not just their own email)');

-- kit_events and vendor_profile (0008/0009) never grant `authenticated` a
-- table-level privilege at all — zero policies plus no grant means every
-- direct select fails at the privilege check, team member or not, same story
-- as products above. Both tables are reachable only through their SECURITY
-- DEFINER functions (emit_metric, get_or_create_vendor_profile, upsert_vendor_profile).
select throws_ok(
  $$ select 1 from merqo.kit_events $$,
  '42501', null,
  'team member cannot SELECT kit_events directly (no grant; only emit_metric() writes)');
select throws_ok(
  $$ select 1 from merqo.vendor_profile $$,
  '42501', null,
  'team member cannot SELECT vendor_profile directly (no grant; only the SECURITY DEFINER functions)');

-- vendor_feedback_team_select's USING clause is `is_merqo_team(auth.uid())`
-- — same row-independent predicate as merqo_team — and `authenticated` DOES
-- have a table-level grant (0011), so a team member sees every vendor's row.
select isnt_empty(
  $$ select 1 from merqo.vendor_feedback where id = '00000000-0000-0000-0000-000000100001' $$,
  'team member reads vendor_feedback (team-select policy)');

-- dashboard_prefs is owner-only (no team-sees-all override, unlike
-- merqo_team/vendor_links/vendor_feedback above) — a team member's own
-- first-visit insert works, but they see only their own row, never a
-- vendor's.
select lives_ok(
  $$ insert into merqo.dashboard_prefs (user_id, tour_seen_at) values ('00000000-0000-0000-0000-00000000000a', null) $$,
  'team member inserts their own dashboard_prefs row (first mark-seen path)');
select isnt_empty(
  $$ select 1 from merqo.dashboard_prefs where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'team member reads its own dashboard_prefs row');
select is_empty(
  $$ select 1 from merqo.dashboard_prefs where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'team member cannot read another user''s dashboard_prefs row (owner-only, no team override)');
select throws_ok(
  $$ insert into merqo.dashboard_prefs (user_id, tour_seen_at) values ('00000000-0000-0000-0000-00000000000c', now()) $$,
  '42501', null,
  'team member cannot insert a dashboard_prefs row for a different user (insert-policy check)');

-- ── Act as an ordinary vendor (not on the team) ───────────────────────────────
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '00000000-0000-0000-0000-00000000000b', 'role', 'authenticated', 'email', 'vendor-b@test.local')::text,
  true);

-- Same is_merqo_team(auth.uid()) predicate as above, now false for vendor-b
-- (not a merqo_team row) — filters the whole table to empty, no privilege
-- error (the grant is unconditional, same as the team-member case).
select is_empty(
  $$ select 1 from merqo.merqo_team $$,
  'non-team vendor cannot read merqo_team');

-- Same missing-grant story as the team-member case above: the denial is at
-- the GRANT level, independent of team membership, so a non-team vendor's
-- direct select also throws 42501 rather than returning an empty set.
select throws_ok(
  $$ select 1 from merqo.products $$,
  '42501', null,
  'non-team vendor cannot SELECT products directly either (no grant, not a team-membership check)');

-- vendor_links_own_select's email branch: vendor-b's own row (lower(email)
-- matches lower(jwt ->> 'email')) is visible.
select isnt_empty(
  $$ select 1 from merqo.vendor_links where id = '00000000-0000-0000-0000-0000000e0001' $$,
  'vendor reads its own vendor_links row (matched by email)');
-- ...but a row keyed to a different email is filtered out (not a team member,
-- and the emails don't match).
select is_empty(
  $$ select 1 from merqo.vendor_links where id = '00000000-0000-0000-0000-0000000e0002' $$,
  'vendor cannot read another email''s vendor_links row');

-- Same missing-grant story as the team-member case: denial is independent
-- of team membership, so a non-team vendor's direct select also throws
-- 42501 rather than returning an empty set.
select throws_ok(
  $$ select 1 from merqo.kit_events $$,
  '42501', null,
  'vendor cannot SELECT kit_events directly either (no grant)');
select throws_ok(
  $$ select 1 from merqo.vendor_profile $$,
  '42501', null,
  'vendor cannot SELECT vendor_profile directly either (no grant)');

-- vendor_feedback has no self-scoped select policy — only the team-select
-- policy exists — so a non-team vendor's own feedback row is filtered out
-- (the grant exists, so this is an empty result, not a privilege error).
select is_empty(
  $$ select 1 from merqo.vendor_feedback where id = '00000000-0000-0000-0000-000000100001' $$,
  'vendor cannot read even its own vendor_feedback row directly (no self-select policy)');

-- upsert_vendor_profile's ownership check (added after a review caught a
-- cross-tenant write bug — see docs/superpowers/plans/2026-07-16-shared-
-- vendor-profile.md): a logged-in caller may only upsert their own vendor_id.
select lives_ok(
  $$ select merqo.upsert_vendor_profile('00000000-0000-0000-0000-00000000000b', 'Updated Stall', '{}'::jsonb) $$,
  'vendor upserts its own vendor_profile via the SECURITY DEFINER function');
select throws_like(
  $$ select merqo.upsert_vendor_profile('00000000-0000-0000-0000-00000000000a', 'Hijacked Stall', '{}'::jsonb) $$,
  'not authorized to modify vendor_id%',
  'vendor cannot upsert another vendor_id''s profile (ownership check in upsert_vendor_profile)');

select isnt_empty(
  $$ select 1 from merqo.dashboard_prefs where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'vendor reads its own dashboard_prefs row');
select is_empty(
  $$ select 1 from merqo.dashboard_prefs where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'vendor cannot read another user''s dashboard_prefs row');
select lives_ok(
  $$ update merqo.dashboard_prefs set tour_seen_at = now() where user_id = '00000000-0000-0000-0000-00000000000b' $$,
  'vendor updates its own dashboard_prefs row (markTourSeen''s upsert path)');
select throws_ok(
  $$ insert into merqo.dashboard_prefs (user_id, tour_seen_at) values ('00000000-0000-0000-0000-00000000000c', now()) $$,
  '42501', null,
  'vendor cannot insert a dashboard_prefs row for a different user either (insert-policy check)');

-- merqo.billing_settings (0017): public-read singleton, no UPDATE policy
-- for any client role — writes go through the service-role admin action
-- only.
select isnt_empty(
  $$ select 1 from merqo.billing_settings where id = 1 $$,
  'authenticated reads billing_settings');
select throws_ok(
  $$ update merqo.billing_settings set bundle_discount_enabled = true where id = 1 $$,
  '42501', null,
  'authenticated cannot update billing_settings (no UPDATE policy/grant)');

-- ── Act as anon ───────────────────────────────────────────────────────────
-- `anon` only ever received `grant usage on schema merqo` (0001) — schema
-- USAGE lets it resolve object names but grants no table-level privilege.
-- None of the six tables ever grants `anon` a table-level SELECT (only
-- `authenticated` gets merqo_team in 0001, vendor_links in 0003, and
-- vendor_feedback in 0011; products/kit_events/vendor_profile never get one
-- for any role but service_role). So every direct select below fails the
-- privilege check before RLS is ever evaluated — 42501, not an empty result set.
reset role;
-- request.jwt.claims is transaction-local (set_config's is_local=true), not
-- role-local — it would otherwise still carry vendor-b's sub from above, so
-- auth.uid() would resolve to a real vendor even under the anon role. Clear
-- it to actually simulate an unauthenticated request.
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok(
  $$ select 1 from merqo.merqo_team $$,
  '42501', null,
  'anon cannot read merqo_team (no SELECT grant)');
select throws_ok(
  $$ select 1 from merqo.products $$,
  '42501', null,
  'anon cannot read products (no SELECT grant)');
select throws_ok(
  $$ select 1 from merqo.vendor_links $$,
  '42501', null,
  'anon cannot read vendor_links (no SELECT grant)');
select throws_ok(
  $$ select 1 from merqo.kit_events $$,
  '42501', null,
  'anon cannot read kit_events (no SELECT grant)');
select throws_ok(
  $$ select 1 from merqo.vendor_profile $$,
  '42501', null,
  'anon cannot read vendor_profile (no SELECT grant)');
select throws_ok(
  $$ select 1 from merqo.vendor_feedback $$,
  '42501', null,
  'anon cannot read vendor_feedback (no SELECT grant)');
select throws_ok(
  $$ select 1 from merqo.dashboard_prefs $$,
  '42501', null,
  'anon cannot read dashboard_prefs (no SELECT grant)');

-- submit_vendor_feedback's explicit grant (0011) is to `authenticated`, but
-- Postgres' default PUBLIC execute grant on new functions isn't revoked, so
-- anon can still call it — and hits the function's own `auth.uid() is null`
-- check instead.
select throws_like(
  $$ select merqo.submit_vendor_feedback('qkit-rlstest', 5, 'hi') $$,
  'not authorized',
  'anon cannot call submit_vendor_feedback (auth.uid() is null check)');

select isnt_empty(
  $$ select 1 from merqo.billing_settings where id = 1 $$,
  'anon reads billing_settings (not secret - a future kit plan page may read it directly)');
select throws_ok(
  $$ update merqo.billing_settings set bundle_discount_enabled = true where id = 1 $$,
  '42501', null,
  'anon cannot update billing_settings (no UPDATE policy/grant)');

reset role;

select * from finish();
rollback;
