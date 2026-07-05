-- Seed the "coming soon" kits shown on the public landing so the waitlist
-- (merqo.vendor_links.product_slug → merqo.products.slug FK) has rows to point
-- at. Display copy for these lives in src/lib/kits.ts; this row only backs the
-- waitlist write. Idempotent — safe to re-run.

insert into merqo.products (slug, name, status)
values
  ('loopkit', 'Merqo loopkit — Loyalty', 'coming_soon'),
  ('shopkit', 'Merqo shopkit — Store', 'coming_soon')
on conflict (slug) do nothing;
