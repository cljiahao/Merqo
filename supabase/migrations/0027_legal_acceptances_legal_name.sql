-- merqo/supabase/migrations/0027_legal_acceptances_legal_name.sql
-- The evidentiary purpose of legal_acceptances (who accepted what) needs the
-- accepting vendor's typed legal name on the row, not just their auth email —
-- the checkbox form (@merqo/ui's TermsAcceptanceCheckbox, name="legal_name")
-- already collects it, but nothing on the write path persisted it. `not null`
-- is safe here: no real vendor has accepted anything on any kit yet, so
-- there's no existing row to backfill.

alter table merqo.legal_acceptances add column legal_name text not null;
