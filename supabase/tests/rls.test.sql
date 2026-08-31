-- merqo/supabase/tests/rls.test.sql
-- RLS isolation — pgTAP, run with `supabase test db`.
-- Covers merqo's eleven RLS-bearing tables: merqo_team (team-membership gates
-- visibility of the WHOLE table, not just the caller's own row — see the
-- comment below), products (RLS is a backstop only; `authenticated` has no
-- table-level grant at all, so metrics_secret never reaches a browser-reachable
-- path per migration 0001/0003), vendor_links (own-email select + team-sees-all),
-- kit_events and vendor_profile (0008/0009: RLS enabled with zero policies and
-- no table-level grant to anyone — reachable only through their SECURITY
-- DEFINER functions), vendor_feedback (0011: team-select policy + grant,
-- writes only via submit_vendor_feedback), billing_settings (0017:
-- public-read singleton, no UPDATE grant to any client role), customers
-- (0018, widened by 0019: RLS enabled with zero policies and no
-- table-level grant to anyone — reachable only through upsert_customer()
-- and 0019's three Telegram-identity RPCs — see the "Telegram identity"
-- block below for the PK/constraint-change verification 0019's own plan
-- called for), telegram_link_tokens (0019, widened by 0020's `kind` column:
-- RLS enabled, zero client policies, service-role only — same shape as
-- customers' own zero-grant convention, restated via an explicit
-- `grant ... to service_role` since 0012's blanket grant predates this
-- table), and vendor_telegram (0020: RLS enabled, own-row select via
-- `vendor_id = (select auth.uid())`, no client write grant — writes only via
-- the service-role client, same shape as every kit's own now-retired copy of
-- this exact table), and vendor_sync_state (0023: RLS enabled, zero client
-- policies, service-role only — the dashboard-open kit-sync throttle marker).
-- Runs in ONE rolled-back transaction with inline fixed-UUID fixtures.

begin;
select plan(86);

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

-- vendor_telegram (0020) — one standing link, vendor-b's own row, used by
-- the own-row-select/no-team-override/no-client-write-grant tests below.
insert into merqo.vendor_telegram (vendor_id, chat_id)
values ('00000000-0000-0000-0000-00000000000b', 555111);

-- vendor_sync_state (0023) — service-role-only throttle marker, no client
-- role gets any grant; one row so the no-read tests below have a target.
insert into merqo.vendor_sync_state (email) values ('vendor-b@test.local');

-- ── RLS is actually enabled on every protected table ─────────────────────────
select ok((select relrowsecurity from pg_class where oid = 'merqo.merqo_team'::regclass), 'RLS on merqo_team');
select ok((select relrowsecurity from pg_class where oid = 'merqo.products'::regclass), 'RLS on products');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_links'::regclass), 'RLS on vendor_links');
select ok((select relrowsecurity from pg_class where oid = 'merqo.kit_events'::regclass), 'RLS on kit_events');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_profile'::regclass), 'RLS on vendor_profile');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_feedback'::regclass), 'RLS on vendor_feedback');
select ok((select relrowsecurity from pg_class where oid = 'merqo.dashboard_prefs'::regclass), 'RLS on dashboard_prefs');
select ok((select relrowsecurity from pg_class where oid = 'merqo.customers'::regclass), 'RLS on customers');
select ok((select relrowsecurity from pg_class where oid = 'merqo.telegram_link_tokens'::regclass), 'RLS on telegram_link_tokens');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_telegram'::regclass), 'RLS on vendor_telegram');
select ok((select relrowsecurity from pg_class where oid = 'merqo.vendor_sync_state'::regclass), 'RLS on vendor_sync_state');

-- merqo.upsert_customer (0018): first call inserts, a repeat call for the
-- same (vendor_id, phone) updates name/last_seen_at but leaves
-- first_seen_at untouched. Exercised directly under the default/superuser
-- test role (bypasses RLS) since this table grants no client role direct
-- SELECT - only through the SECURITY DEFINER function itself.
select lives_ok(
  $$ select merqo.upsert_customer('00000000-0000-0000-0000-00000000000a', '+6591234567', 'First Name') $$,
  'upsert_customer inserts a new customer row');
select results_eq(
  $$ select count(*)::int, name from merqo.customers
     where vendor_id = '00000000-0000-0000-0000-00000000000a' and phone = '+6591234567'
     group by name $$,
  $$ values (1, 'First Name'::text) $$,
  'new customer row has the given name, exactly one row for this (vendor_id, phone)');
select lives_ok(
  $$ select merqo.upsert_customer('00000000-0000-0000-0000-00000000000a', '+6591234567', 'Updated Name') $$,
  'upsert_customer on the same (vendor_id, phone) updates instead of duplicating');
select results_eq(
  $$ select count(*)::int, name from merqo.customers
     where vendor_id = '00000000-0000-0000-0000-00000000000a' and phone = '+6591234567'
     group by name $$,
  $$ values (1, 'Updated Name'::text) $$,
  'repeat upsert updates the name and still exactly one row (no duplicate insert)');

-- ── Telegram identity (0019) — customers widening + the three new RPCs ───────
-- Exercised under the default/superuser test role, same as upsert_customer
-- above (this table grants no client role direct access at all).

-- customers_identity_check: neither phone nor telegram_chat_id is rejected.
select throws_ok(
  $$ insert into merqo.customers (vendor_id) values ('00000000-0000-0000-0000-00000000000a') $$,
  '23514', null,
  'customers_identity_check rejects a row with neither phone nor telegram_chat_id');

-- A phone-less, Telegram-only customer is exactly the case 0019 widened the
-- table for — allowed post-widening (would have been impossible under the
-- old (vendor_id, phone) PK, which required a non-null phone).
select lives_ok(
  $$ insert into merqo.customers (vendor_id, telegram_chat_id, consent_given_at)
     values ('00000000-0000-0000-0000-00000000000a', 111222, now()) $$,
  'a phone-less, Telegram-only customer row is allowed post-widening');

-- merqo.upsert_customer_telegram: first call inserts, keyed purely on
-- (vendor_id, telegram_chat_id) — distinct from upsert_customer's
-- phone-keyed path exercised above.
select lives_ok(
  $$ select merqo.upsert_customer_telegram('00000000-0000-0000-0000-00000000000a', 333444, 'qkit:order-1') $$,
  'upsert_customer_telegram inserts a new phone-less customer row');
select results_eq(
  $$ select count(*)::int, pending_notify_ref from merqo.customers
     where vendor_id = '00000000-0000-0000-0000-00000000000a' and telegram_chat_id = 333444
     group by pending_notify_ref $$,
  $$ values (1, 'qkit:order-1'::text) $$,
  'new row has the given pending_notify_ref, exactly one row for this (vendor_id, telegram_chat_id)');

-- A repeat /start for the same chat (connecting again for a later order)
-- refreshes pending_notify_ref instead of duplicating the row.
select lives_ok(
  $$ select merqo.upsert_customer_telegram('00000000-0000-0000-0000-00000000000a', 333444, 'qkit:order-2') $$,
  'upsert_customer_telegram on the same (vendor_id, telegram_chat_id) updates instead of duplicating');
select results_eq(
  $$ select count(*)::int, pending_notify_ref from merqo.customers
     where vendor_id = '00000000-0000-0000-0000-00000000000a' and telegram_chat_id = 333444
     group by pending_notify_ref $$,
  $$ values (1, 'qkit:order-2'::text) $$,
  'repeat upsert updates pending_notify_ref and still exactly one row (no duplicate insert)');

-- merqo.claim_customer_by_notify_ref (notify_ref mode): matches, returns
-- the linked chat_id, and clears pending_notify_ref atomically — single-use.
select results_eq(
  $$ select merqo.claim_customer_by_notify_ref('00000000-0000-0000-0000-00000000000a', 'qkit:order-2') $$,
  $$ values (333444::bigint) $$,
  'claim_customer_by_notify_ref returns the linked chat_id on a match');
select results_eq(
  $$ select pending_notify_ref from merqo.customers
     where vendor_id = '00000000-0000-0000-0000-00000000000a' and telegram_chat_id = 333444 $$,
  $$ values (null::text) $$,
  'claim_customer_by_notify_ref clears pending_notify_ref (single-use)');
-- A second claim with the SAME (now-cleared) ref finds nothing — proves
-- single-use, not just "clears eventually."
select results_eq(
  $$ select merqo.claim_customer_by_notify_ref('00000000-0000-0000-0000-00000000000a', 'qkit:order-2') $$,
  $$ values (null::bigint) $$,
  'claim_customer_by_notify_ref is a no-op on a repeat call with the same (already-cleared) ref');
select results_eq(
  $$ select merqo.claim_customer_by_notify_ref('00000000-0000-0000-0000-00000000000a', 'no-such-ref') $$,
  $$ values (null::bigint) $$,
  'claim_customer_by_notify_ref returns null for an unknown ref, never an error');

-- merqo.find_customer_telegram_by_phone (phone mode): the real
-- cross-kit-reuse case the design doc names — a customer with BOTH a
-- phone and a linked chat_id.
select lives_ok(
  $$ insert into merqo.customers (vendor_id, phone, telegram_chat_id, consent_given_at, pending_notify_ref)
     values ('00000000-0000-0000-0000-00000000000a', '+6590000001', 555666, now(), 'qkit:order-3') $$,
  'a customer with both phone and telegram_chat_id (the cross-kit-reuse case) is allowed');
select results_eq(
  $$ select merqo.find_customer_telegram_by_phone('00000000-0000-0000-0000-00000000000a', '+6590000001') $$,
  $$ values (555666::bigint) $$,
  'find_customer_telegram_by_phone returns the linked chat_id on a match');
select results_eq(
  $$ select pending_notify_ref from merqo.customers
     where vendor_id = '00000000-0000-0000-0000-00000000000a' and phone = '+6590000001' $$,
  $$ values ('qkit:order-3'::text) $$,
  'find_customer_telegram_by_phone (phone mode) does NOT clear pending_notify_ref — not single-use');
select results_eq(
  $$ select merqo.find_customer_telegram_by_phone('00000000-0000-0000-0000-00000000000a', '+6591234567') $$,
  $$ values (null::bigint) $$,
  'find_customer_telegram_by_phone returns null when the phone matches but no Telegram chat is linked');

-- customers_vendor_telegram_idx (partial unique index) enforcement: a bare
-- INSERT (not the upsert RPC's ON CONFLICT path) with an already-used
-- (vendor_id, telegram_chat_id) is rejected.
select throws_ok(
  $$ insert into merqo.customers (vendor_id, telegram_chat_id, consent_given_at)
     values ('00000000-0000-0000-0000-00000000000a', 333444, now()) $$,
  '23505', null,
  'customers_vendor_telegram_idx rejects a duplicate (vendor_id, telegram_chat_id)');

-- ── Vendor Telegram (0020) — telegram_link_tokens' new `kind` column ─────────
-- Exercised under the default/superuser test role, same as the fixture
-- inserts above (telegram_link_tokens grants no client role direct access).

-- default 'customer' backfills a row inserted the pre-0020 way (notify_ref/
-- kit_slug given, kind omitted) — 0020's own plan required verifying this
-- against a real row, not just the migration's syntax.
select lives_ok(
  $$ insert into merqo.telegram_link_tokens (token, vendor_id, kit_slug, notify_ref, expires_at)
     values ('rls-test-customer-token', '00000000-0000-0000-0000-00000000000a', 'qkit', 'qkit:order-rls', now() + interval '30 minutes') $$,
  'inserting a telegram_link_tokens row without kind (the pre-0020 shape) succeeds');
select results_eq(
  $$ select kind from merqo.telegram_link_tokens where token = 'rls-test-customer-token' $$,
  $$ values ('customer'::text) $$,
  'the omitted-kind row backfills to kind=''customer''');

-- kind='vendor' with both notify_ref and kit_slug null — 0020 widens both
-- to nullable specifically so a standing vendor link isn't forced to
-- fabricate an order-scoped notify_ref.
select lives_ok(
  $$ insert into merqo.telegram_link_tokens (token, vendor_id, kind, expires_at)
     values ('rls-test-vendor-token', '00000000-0000-0000-0000-00000000000b', 'vendor', now() + interval '30 minutes') $$,
  'inserting a kind=''vendor'' token with null notify_ref/kit_slug succeeds');

-- the check constraint rejects anything outside ('customer', 'vendor').
select throws_ok(
  $$ insert into merqo.telegram_link_tokens (token, vendor_id, kind, expires_at)
     values ('rls-test-bad-kind', '00000000-0000-0000-0000-00000000000b', 'bogus', now() + interval '30 minutes') $$,
  '23514', null,
  'the kind check constraint rejects a value outside (''customer'', ''vendor'')');

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
select throws_ok(
  $$ select 1 from merqo.customers $$,
  '42501', null,
  'team member cannot SELECT customers directly (no grant; only upsert_customer())');
select throws_ok(
  $$ select 1 from merqo.telegram_link_tokens $$,
  '42501', null,
  'team member cannot SELECT telegram_link_tokens directly (service-role only)');
select throws_ok(
  $$ select 1 from merqo.vendor_sync_state $$,
  '42501', null,
  'team member cannot SELECT vendor_sync_state directly (service-role only)');

-- vendor_telegram_own's USING clause is `vendor_id = (select auth.uid())` —
-- an actual row-scoped predicate, unlike merqo_team/vendor_links/
-- vendor_feedback's team-sees-all policies above. A team member (not
-- vendor-b) sees nothing, even though `authenticated` has a table-level
-- SELECT grant (0020) — this is a genuine RLS filter, not a privilege error.
select is_empty(
  $$ select 1 from merqo.vendor_telegram where vendor_id = '00000000-0000-0000-0000-00000000000b' $$,
  'team member cannot read another vendor''s vendor_telegram row (own-row policy, no team override)');
-- The grant is SELECT-only (0020) — insert/update/delete all fail at the
-- privilege check regardless of which vendor_id is targeted, before RLS is
-- ever evaluated.
select throws_ok(
  $$ insert into merqo.vendor_telegram (vendor_id, chat_id) values ('00000000-0000-0000-0000-00000000000a', 999) $$,
  '42501', null,
  'team member cannot INSERT into vendor_telegram directly (no client write grant)');

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
select throws_ok(
  $$ select 1 from merqo.customers $$,
  '42501', null,
  'vendor cannot SELECT customers directly either (no grant)');
select throws_ok(
  $$ select 1 from merqo.telegram_link_tokens $$,
  '42501', null,
  'vendor cannot SELECT telegram_link_tokens directly either (service-role only)');

-- vendor_telegram_own: vendor-b's own row IS visible (unlike
-- telegram_link_tokens above, which grants no client role anything at all).
select isnt_empty(
  $$ select 1 from merqo.vendor_telegram where vendor_id = '00000000-0000-0000-0000-00000000000b' $$,
  'vendor reads its own vendor_telegram row');
-- Same SELECT-only grant as the team-member case: an update on the
-- caller's OWN row still fails at the privilege check, not a policy
-- filter — disconnect is a service-role-only action (the profile page's
-- disconnectVendorTelegram server action), never a direct client write.
select throws_ok(
  $$ update merqo.vendor_telegram set chat_id = 777 where vendor_id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501', null,
  'vendor cannot UPDATE its own vendor_telegram row directly (no client write grant)');

select lives_ok(
  $$ select merqo.upsert_customer('00000000-0000-0000-0000-00000000000b', '+6598765432', 'A Customer') $$,
  'vendor (authenticated, any vendor_id) can call upsert_customer - no ownership check, mirrors how a kit backend already resolves the real vendor_id server-side before calling this');

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
  $$ select 1 from merqo.customers $$,
  '42501', null,
  'anon cannot read customers (no SELECT grant)');
select throws_ok(
  $$ select 1 from merqo.telegram_link_tokens $$,
  '42501', null,
  'anon cannot read telegram_link_tokens (service-role only)');
select throws_ok(
  $$ select 1 from merqo.vendor_telegram $$,
  '42501', null,
  'anon cannot read vendor_telegram (no SELECT grant — that''s authenticated-only)');
select throws_ok(
  $$ select 1 from merqo.vendor_sync_state $$,
  '42501', null,
  'anon cannot read vendor_sync_state (service-role only)');

-- The three 0019 Telegram-identity RPCs have no in-body caller check at
-- all (unlike upsert_vendor_profile/submit_vendor_feedback) —
-- customerNotifySecretOk is the only gate, enforced at the HTTP layer.
-- REVOKE EXECUTE FROM PUBLIC in 0019 is therefore load-bearing: without
-- it, Postgres' default PUBLIC execute grant would let anon call these
-- directly over PostgREST's RPC endpoint and bypass that gate entirely.
select throws_ok(
  $$ select merqo.upsert_customer_telegram('00000000-0000-0000-0000-00000000000a', 777888, 'anon-attempt') $$,
  '42501', null,
  'anon cannot call upsert_customer_telegram (PUBLIC execute revoked)');
select throws_ok(
  $$ select merqo.claim_customer_by_notify_ref('00000000-0000-0000-0000-00000000000a', 'qkit:order-3') $$,
  '42501', null,
  'anon cannot call claim_customer_by_notify_ref (PUBLIC execute revoked)');
select throws_ok(
  $$ select merqo.find_customer_telegram_by_phone('00000000-0000-0000-0000-00000000000a', '+6590000001') $$,
  '42501', null,
  'anon cannot call find_customer_telegram_by_phone (PUBLIC execute revoked — closes a customer phone/chat-id enumeration leak)');
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
