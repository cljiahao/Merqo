-- stockkit's own repo shipped its full merqo cutover (metrics, vendor-status,
-- vendor-provision, vendor-activity endpoints) in this same work session.
-- Same bug class as loopkit (0013) and paykit (0014): it was seeded
-- 'coming_soon' in 0004_kit_consolidation.sql despite src/lib/kits.ts already
-- showing it as fully live, so listLiveProducts() has silently excluded it
-- from vendor auto-discovery/provisioning/metrics/activity until now. Only
-- flips the status column here — stockkit's metrics_url/metrics_secret/
-- provision_secret values are set out-of-band (Supabase dashboard/SQL
-- editor), same as every other kit's row.
update merqo.products set status = 'live' where slug = 'stockkit';
