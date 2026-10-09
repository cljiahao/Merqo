begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email) values
  ('00340000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'private-helper-a@test.local'),
  ('00340000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'private-helper-b@test.local');

-- A disposable owner-trigger fixture exercises the same SECURITY DEFINER chain
-- as Loopkit's customer synchronization, without accessing Vault or the network.
create function merqo.test_private_customer_sync() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform merqo.upsert_customer(new.vendor_id, new.phone, new.name);
  return new;
end;
$$;
revoke all on function merqo.test_private_customer_sync() from public;
create table merqo.test_private_customer_source (vendor_id uuid, phone text, name text);
grant insert on merqo.test_private_customer_source to authenticated;
create trigger sync_customer after insert on merqo.test_private_customer_source
  for each row execute function merqo.test_private_customer_sync();

set local role anon;
select throws_ok($$ select merqo.upsert_customer('00340000-0000-0000-0000-000000000001', '+6593400001', 'Poisoned') $$,
  '42501', null, 'anonymous customer mutation is denied before its body runs');
select throws_ok($$ select merqo.notify_founder_telegram('unsolicited') $$,
  '42501', null, 'anonymous founder notification is denied before Vault access');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00340000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select throws_ok($$ select merqo.upsert_customer('00340000-0000-0000-0000-000000000001', '+6593400001', 'Poisoned') $$,
  '42501', null, 'authenticated vendor cannot mutate another vendor customer');
select throws_ok($$ select merqo.upsert_customer('00340000-0000-0000-0000-000000000002', '+6593400002', 'Direct') $$,
  '42501', null, 'customer sync is unavailable even for the caller own vendor');
select throws_ok($$ select merqo.notify_founder_telegram('unsolicited') $$,
  '42501', null, 'authenticated founder notification is denied');
select lives_ok($$ insert into merqo.test_private_customer_source values
  ('00340000-0000-0000-0000-000000000002', '+6593400002', 'Trusted trigger') $$,
  'owner trigger can synchronize a customer after execute revocation');
reset role;

select results_eq($$ select name from merqo.customers where vendor_id = '00340000-0000-0000-0000-000000000002' and phone = '+6593400002' $$,
  $$ values ('Trusted trigger'::text) $$, 'trusted trigger persisted the expected customer');
select is_empty($$ select 1 from merqo.customers where vendor_id = '00340000-0000-0000-0000-000000000001' $$,
  'denied cross-vendor calls left no customer rows');

select ok(not has_function_privilege(role_name, signature, 'EXECUTE'), role_name || ' cannot execute ' || signature)
from (values ('anon'), ('authenticated'), ('service_role')) roles(role_name)
cross join (values
  ('merqo.notify_founder_telegram(text)'),
  ('merqo.trg_notify_founder_support()'),
  ('merqo.trg_notify_founder_vendor_feedback()'),
  ('merqo.trg_notify_founder_hub_feedback()')) functions(signature);

select ok(has_table_privilege('service_role', 'merqo.billing_settings', 'SELECT'), 'service can read the billing singleton');
select ok(has_table_privilege('service_role', 'merqo.billing_settings', 'UPDATE'), 'service can update the billing singleton');
select ok(not has_table_privilege('authenticated', 'merqo.billing_settings', 'UPDATE'), 'vendor cannot update billing');
select ok(not has_table_privilege('anon', 'merqo.billing_settings', 'UPDATE'), 'anonymous caller cannot update billing');
set local role service_role;
select lives_ok($$ select merqo.upsert_customer('00340000-0000-0000-0000-000000000001', '+6593400001', 'Trusted backend') $$,
  'trusted service customer synchronization remains available');
select lives_ok($$ update merqo.billing_settings set bundle_discount_enabled = not bundle_discount_enabled where id = 1 $$,
  'service can change billing through the existing admin path');
select throws_ok($$ select merqo.notify_founder_telegram('unsolicited') $$,
  '42501', null, 'service cannot invoke the trigger-only notification helper');
reset role;

select * from finish();
rollback;
