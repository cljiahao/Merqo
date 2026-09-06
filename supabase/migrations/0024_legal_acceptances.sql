-- merqo/supabase/migrations/0024_legal_acceptances.sql
-- Append-only acceptance record. One row per (vendor, doc, version) they
-- accepted — never updated in place, so the full history of what a vendor
-- agreed to is always reconstructable (a lawyer-review / dispute-evidence
-- requirement, see ../docs/superpowers/specs/2026-09-04-merqo-legal-docs-design.md).
-- doc_sha256 is the hash of the exact rendered content the kit showed at
-- acceptance time (computed kit-side from @merqo/ui's getLegalDocSource),
-- so a row proves what was actually shown, not just a version label.

create table merqo.legal_acceptances (
  id           uuid primary key default gen_random_uuid(),
  vendor_email text not null,
  auth_uid     uuid,
  doc_type     text not null check (doc_type in ('terms', 'privacy', 'pilot')),
  doc_version  text not null,
  doc_sha256   text not null,
  kit_slug     text not null,
  ip           text,
  user_agent   text,
  accepted_at  timestamptz not null default now(),
  unique (vendor_email, doc_type, doc_version)
);

alter table merqo.legal_acceptances enable row level security;

grant select, insert on merqo.legal_acceptances to service_role;
grant select on merqo.legal_acceptances to authenticated;

create policy legal_acceptances_own_select on merqo.legal_acceptances
  for select using (
    merqo.is_merqo_team((select auth.uid()))
    or lower(vendor_email) = lower((select auth.jwt() ->> 'email'))
  );
