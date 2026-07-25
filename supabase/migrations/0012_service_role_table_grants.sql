-- 0001's `grant all on all tables in schema merqo to service_role` only
-- covered the tables that existed in the schema at the moment it ran
-- (merqo_team, products, vendor_links) — it's a one-time snapshot, not an
-- ongoing default. Every table added since (support_messages 0007,
-- kit_events 0008, vendor_profile 0009, vendor_feedback 0011) never got an
-- equivalent grant, so the service client's direct reads/writes on them
-- (e.g. listOpenSupportMessages()) fail with permission-denied on a
-- byte-for-byte fresh migration replay — caught via real local Supabase
-- interaction testing, not by the pgTAP suite (which runs as the Postgres
-- superuser and never exercises table-level grants). Re-run the same grant
-- so it also covers every table added since.

grant all on all tables in schema merqo to service_role;
grant all on all sequences in schema merqo to service_role;
