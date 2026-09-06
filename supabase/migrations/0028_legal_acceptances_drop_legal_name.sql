-- merqo/supabase/migrations/0028_legal_acceptances_drop_legal_name.sql
-- The typed legal-name field added extra friction to a plain ToS/Privacy
-- clickwrap for no real evidentiary gain over the existing (vendor_email,
-- auth_uid, doc_type, doc_version, ip, user_agent, timestamp) record — most
-- SaaS ToS acceptance (Vercel, Supabase) doesn't collect a signatory name
-- either. No real vendor has accepted anything on any kit yet, so there's
-- no existing data to preserve.

alter table merqo.legal_acceptances drop column legal_name;
