---
name: supabase-migrate
description: Apply Supabase schema migrations for merqo, with a safety gate.
allowed-tools: "Bash(supabase *), Bash(pnpm *)"
disable-model-invocation: true
---

Merqo lives in the SHARED Supabase project (one project, schema per kit). Merqo's
tables live in the `merqo` schema; qkit owns `public`. Migrations live in
`supabase/migrations/`.

## Apply schema

**Local (Dockerized dev):**

- `supabase migration up` — apply pending migrations to the running local DB.
  (Or `supabase db reset` to rebuild local from `supabase/migrations/`.)

**Linked (hosted, shared project) — only when intentionally changing the deployed DB:**

- `supabase db push` — applies pending migrations to the linked project.

**Without the CLI:**

- Paste each pending migration's SQL into Supabase → SQL Editor → Run, in order
  (`0001_merqo_core.sql`, then `0002_coming_kits.sql`, …).

## Safety gate (before running against the shared hosted project)

- Confirm the linked project ref is correct: `supabase projects list`. This is the
  SHARED project (same as qkit) — a bad migration here can affect the whole org.
- `merqo` must stay in the project's **Exposed schemas** (dashboard → API), or
  supabase-js returns `PGRST106`.
- RLS must stay enabled on `merqo.merqo_team`, `merqo.products`, `merqo.vendor_links` —
  never disable it to make a query work; fix the policy or use the service client
  (server-only) instead.
- Never touch qkit's `public.*` tables from a merqo migration — cross-kit reads go
  over the HTTP metrics API, never a direct cross-schema query.
