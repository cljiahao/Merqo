begin;
select plan(3);
select ok(
  not has_function_privilege('anon', 'merqo.emit_metric(uuid,text,text,jsonb)', 'EXECUTE'),
  'anonymous clients cannot forge metric events'
);
select ok(
  not has_function_privilege('authenticated', 'merqo.emit_metric(uuid,text,text,jsonb)', 'EXECUTE'),
  'authenticated clients cannot forge metric events'
);
select ok(
  has_function_privilege('service_role', 'merqo.emit_metric(uuid,text,text,jsonb)', 'EXECUTE'),
  'trusted service clients retain metric emission'
);
select * from finish();
rollback;
