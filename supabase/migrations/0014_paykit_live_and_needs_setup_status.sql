-- Bugfix found while scoping paykit push-provisioning (2026-07-28 design):
-- paykit was seeded as 'coming_soon' in 0004_kit_consolidation.sql despite
-- src/lib/kits.ts already showing it as fully live — listLiveProducts()
-- filters on THIS column, so paykit has been silently excluded from vendor
-- auto-discovery since 0004 (same bug class as loopkit, fixed in 0013).
update merqo.products set status = 'live' where slug = 'paykit';

-- Widen vendor_links.status to a third value: 'needs_setup', for kits
-- (paykit) that can be identity-provisioned but need a further manual step
-- (real PayNow/bank details) before they're truly active. The original
-- CHECK (0001_merqo_core.sql:34) was declared inline with no explicit name,
-- so its Postgres-assigned name isn't recorded anywhere in this codebase —
-- find and drop it dynamically instead of guessing, then re-add a named
-- constraint so it's unambiguous from here on.
do $$
declare
  existing_constraint text;
begin
  select con.conname into existing_constraint
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'merqo'
    and rel.relname = 'vendor_links'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';

  if existing_constraint is not null then
    execute format(
      'alter table merqo.vendor_links drop constraint %I',
      existing_constraint
    );
  end if;

  alter table merqo.vendor_links
    add constraint vendor_links_status_check
    check (status in ('active', 'waitlist', 'needs_setup'));
end $$;
