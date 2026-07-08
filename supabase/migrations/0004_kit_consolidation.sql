-- Merqo product consolidation (Jul 2026): retire tapkit + slotkit, add paykit +
-- stockkit + reachkit, and give each kit its own Vercel app_url. loopkit and
-- shopkit are kept as-is. Idempotent + FK-safe: vendor_links.product_slug -> products
-- has no ON UPDATE CASCADE, so any tapkit waitlist links are carried onto paykit
-- before the tapkit product row is removed.

-- 1. Upsert all six registry rows + app_url. coming_soon is the only non-live value
--    the status CHECK allows; the finer live/coming/planned split lives in kits.ts.
--    on conflict updates name/app_url only, so an existing qkit 'live' status is kept.
insert into merqo.products (slug, name, status, app_url) values
  ('qkit',     'Merqo qkit — Orders',     'live',        'https://qkit.vercel.app'),
  ('loopkit',  'Merqo loopkit — Loyalty', 'coming_soon', 'https://loopkit.vercel.app'),
  ('shopkit',  'Merqo shopkit — Store',   'coming_soon', 'https://shopkit.vercel.app'),
  ('paykit',   'Merqo paykit — Payments', 'coming_soon', 'https://paykit.vercel.app'),
  ('stockkit', 'Merqo stockkit — Stock',  'coming_soon', 'https://stockkit.vercel.app'),
  ('reachkit', 'Merqo reachkit — Reach',  'coming_soon', 'https://reachkit.vercel.app')
on conflict (slug) do update
  set name = excluded.name, app_url = excluded.app_url;

-- 2. Carry any tapkit waitlist signups onto paykit (skip if the vendor already has
--    a paykit link to avoid violating the (email, product_slug) unique constraint),
--    then delete the leftover tapkit links so the tapkit row can be removed.
update merqo.vendor_links vl set product_slug = 'paykit'
  where vl.product_slug = 'tapkit'
    and not exists (
      select 1 from merqo.vendor_links v2
      where v2.email = vl.email and v2.product_slug = 'paykit'
    );
delete from merqo.vendor_links where product_slug = 'tapkit';

-- 3. Retire products no longer in the lineup (no-op if they were never seeded).
delete from merqo.products where slug in ('tapkit', 'slotkit');
