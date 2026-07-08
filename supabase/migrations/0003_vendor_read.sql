-- Phase 2a: let a signed-in vendor read their OWN vendor_links so /dashboard can
-- render their kit tiles. The vendor_links_own_select policy already scopes rows
-- to the caller's email; this grant is what actually lets the authenticated
-- (cookie) client SELECT. Safe: vendor_links has NO secret column — metrics_secret
-- lives on merqo.products, which is deliberately NOT granted to authenticated.
grant select on merqo.vendor_links to authenticated;

-- Harden the own-select policy: lower() both sides so a mixed-case JWT email still
-- matches the lowercased stored email (grantKit lowercases on write). Team branch
-- unchanged.
drop policy if exists vendor_links_own_select on merqo.vendor_links;
create policy vendor_links_own_select on merqo.vendor_links
  for select using (
    merqo.is_merqo_team((select auth.uid()))
    or lower(email) = lower((select auth.jwt() ->> 'email'))
  );
