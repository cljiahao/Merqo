-- merqo/supabase/migrations/0021_admin_audit.sql
-- Every sibling kit (qkit, loopkit, paykit, stockkit) has its own admin_audit
-- table + recordAudit() helper backing its admin console. Merqo — despite
-- being the console that documents this convergence standard for everyone
-- else — never had one of its own, so its admin actions (kit-access
-- grant/revoke, team add/remove, the bundle-discount toggle, support-message
-- resolution) were completely unlogged. Mirrors paykit's
-- 0006_paykit_admin.sql shape (admin_audit table only — merqo already has
-- its own team-membership predicate, merqo.is_merqo_team(), from
-- 0001_merqo_core.sql, so no separate `admins` allow-list table is needed
-- here).

create table merqo.admin_audit (
  id         uuid primary key default gen_random_uuid(),
  admin_id   uuid not null references auth.users(id),
  action     text not null,
  target_id  uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);
create index admin_audit_created_idx on merqo.admin_audit (created_at desc);

alter table merqo.admin_audit enable row level security;

create policy admin_audit_team_select on merqo.admin_audit
  for select using (merqo.is_merqo_team((select auth.uid())));

-- Immutability from day one: paykit shipped this as a follow-up migration
-- (0009_paykit_admin_audit_immutable.sql) after first granting `all` to
-- service_role; land the narrow grant directly here instead. service_role
-- gets select/insert only — no update/delete grant at all, so even a
-- compromised service-role key can't rewrite history. The app only ever
-- INSERTs (see recordAudit() in src/lib/admin.ts).
grant select on merqo.admin_audit to authenticated;
grant select, insert on merqo.admin_audit to service_role;
