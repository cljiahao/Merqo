begin;
select plan(9);
insert into auth.users(id,instance_id,aud,role,email) values
('11111111-1111-1111-1111-111111111111','00000000-0000-0000-0000-000000000000','authenticated','authenticated','profile-a@test.local');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}',true);
select throws_ok($$select merqo.patch_vendor_profile('22222222-2222-2222-2222-222222222222','Foreign',null)$$,'P0001','not authorized','foreign profile patch denied');
select lives_ok($$select merqo.patch_vendor_profile('11111111-1111-1111-1111-111111111111',null,'{"website":"https://existing.test"}')$$,'links-only first save provisions profile');
select is((merqo.get_or_create_vendor_profile('11111111-1111-1111-1111-111111111111',null)).stall_name,'My Stall','missing name provisioned');
select lives_ok($$select merqo.patch_vendor_profile('11111111-1111-1111-1111-111111111111','Renamed',null)$$,'name patch succeeds');
select is((merqo.get_or_create_vendor_profile('11111111-1111-1111-1111-111111111111',null)).social_links->>'website','https://existing.test','name patch preserves links');
select lives_ok($$select merqo.patch_vendor_profile('11111111-1111-1111-1111-111111111111',null,'{}')$$,'explicit empty links clear');
select is((merqo.get_or_create_vendor_profile('11111111-1111-1111-1111-111111111111',null)).stall_name,'Renamed','links patch preserves name');
select throws_ok($$select merqo.patch_vendor_profile('11111111-1111-1111-1111-111111111111','',null)$$,'P0001','invalid stall name','invalid name rejected');
select ok(not has_function_privilege('anon','merqo.upsert_vendor_profile(uuid,text,jsonb)','execute'),'anonymous legacy writer denied');
select * from finish();
rollback;
