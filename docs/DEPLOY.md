# Merqo — Deploy & Attach Runbook

One shared Supabase project (renamed **merqo**), schema per kit. merqo tables in
`merqo.*`, qkit in `public.*`. merqo pulls qkit metrics over HTTP (bearer secret),
never a direct cross-schema query.

Do the steps in order: **A (Supabase) → B (qkit attach) → C (merqo on Vercel)**.
The metrics secret is shared: the SAME value goes in qkit's Vercel env
(`MERQO_METRICS_SECRET`) and merqo's `merqo.products.metrics_secret`. Keep it out
of git — it lives only in Vercel env + the DB row.

## A. Supabase (shared project)

1. **Rename** the project to `merqo` (Settings → General). Cosmetic — ref/URL/keys unchanged.
2. **Keys** (Settings → API): note Project URL, publishable (anon) key, secret (service_role) key.
3. **Expose the merqo schema**: Settings → API → *Exposed schemas* → add `merqo` → Save.
   (Without this, supabase-js returns PGRST106 for `merqo.*`.)
4. **Auth**: enable *Confirm email* (Auth → Providers/Settings). Security gate — without
   it, someone can sign up as another vendor's email and inherit their `vendor_links`.
5. **Apply the merqo migration** (from the merqo repo):
   ```bash
   pnpm dlx supabase login          # interactive
   pnpm dlx supabase link --project-ref <PROJECT_REF>
   pnpm dlx supabase db push        # creates merqo schema + tables + grants
   ```
6. **Seed the qkit registry row** (SQL editor) — replace the secret placeholder:
   ```sql
   insert into merqo.products (slug, name, status, app_url, metrics_url, metrics_secret)
   values ('qkit', 'Merqo qkit — Queue', 'live',
           'https://<qkit-domain>',
           'https://<qkit-domain>/api/merqo/metrics',
           '<MERQO_METRICS_SECRET>');
   ```
7. **Add yourself to the team** (SQL editor). Find your uuid in Auth → Users:
   ```sql
   insert into merqo.merqo_team (user_id) values ('<your-auth-user-uuid>');
   ```

## B. qkit (attach the metrics endpoint)

1. Review + merge PR **cljiahao/Qkit#11** (`feat: GET /api/merqo/metrics`).
2. qkit Vercel → Environment Variables → add `MERQO_METRICS_SECRET = <same secret>` → redeploy.
3. Verify:
   ```bash
   curl -H "Authorization: Bearer <MERQO_METRICS_SECRET>" https://<qkit-domain>/api/merqo/metrics
   ```
   → `200` JSON with `product: "qkit"` and the metric fields. `401` = secret mismatch.

## C. merqo (Vercel)

1. Vercel → New Project → import `cljiahao/merqo`.
2. Environment Variables (Production + Preview) — **same Supabase project as qkit**:
   - `NEXT_PUBLIC_SUPABASE_URL` = shared project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = anon key
   - `SUPABASE_SECRET_KEY` = service_role key
   - `NEXT_PUBLIC_BASE_URL` = `https://<merqo-domain>`
3. Deploy. If the qkit domain wasn't final at step A.6, update `merqo.products`
   `app_url`/`metrics_url` now.
4. **Smoke**: open `/login`, sign in as the account you added to `merqo_team` →
   `/team` shows the qkit card with live numbers + totals; `/products` shows the
   catalog with a Join-waitlist control.

## Notes

- Rotate the secret by updating both the qkit Vercel env and `merqo.products.metrics_secret`.
- A future qkit `public`→`qkit` schema move is invisible to merqo (HTTP boundary).
