<!-- templateCentral: nextjs@5.8.0 (Supabase variant — shared project, schema per kit) -->

# AGENTS.md — Merqo

> STOP — This project diverges from the stock templateCentral Next.js stack on the
> data layer only. Auth/DB are **Supabase** (`@supabase/ssr`), not better-auth +
> Drizzle. Authorization is enforced in Postgres via **RLS**. Runtime matches tc:
> Next 16, route protection in `src/proxy.ts`, and
> `cookies()`/`headers()`/`params`/`searchParams` are async.

## What Merqo is

The house brand + dashboard for a modular family of small-business tools ("kits")
for Singapore micro/small sellers. `qkit` (queue/orders) is the first, live product.
This app is the public brand landing + a role-gated operator console:
`/dashboard` (cross-product metrics overview, post-login home), `/vendors`
(grant/revoke kit access per vendor), and `/team` (manage Merqo-team members).
It pulls each kit's metrics over an **HTTP API** (bearer secret) — never a direct
cross-schema query.

## Stack

Next.js 16 · App Router · Turbopack · TypeScript strict · Tailwind v4 · shadcn/ui
(new-york) · Zod · Supabase (`@supabase/ssr`) · Vitest · Playwright · pnpm 11 ·
Node ≥24 · deploy target: Vercel

## Commands

```bash
pnpm dev          # dev server — http://localhost:3000
pnpm build        # production build
pnpm test         # run test suite (vitest)
pnpm test:e2e     # playwright public smoke
pnpm check        # prettier --check + eslint + tsc --noEmit
pnpm format       # prettier --write
```

## File Layout

```
src/app/                    — app router (landing, dashboard, server actions)
src/app/page.tsx            — public brand landing (static-prerendered)
src/app/dashboard/          — cross-product metrics overview (auth-gated home)
src/app/vendors/            — grant/revoke vendor kit access (auth-gated)
src/app/team/               — manage Merqo-team members (auth-gated)
src/app/actions/            — server actions (public waitlist)
src/app/login/              — email/password sign-in
src/proxy.ts                — Supabase session refresh + /dashboard,/vendors,/team guard (Next 16)
src/components/landing/      — landing sections (nav, hero, kit-grid, …)
src/components/ui/           — shadcn primitives (CLI-managed, do not hand-edit)
src/lib/supabase/           — browser / server (schema=merqo) / service clients + mw helper
src/lib/kits.ts             — the kit family config (landing roadmap source of truth)
src/lib/metrics-client.ts   — degraded fetch of a kit's HTTP metrics endpoint
supabase/migrations/        — SQL schema (merqo.* tables) + RLS + grants
```

## Data model

One shared Supabase project, schema per kit. Merqo owns `merqo.*`:
`merqo_team` (team membership, managed on `/team`), `products` (kit registry +
per-product `metrics_secret`, surfaced on `/dashboard`), `vendor_links`
(vendor↔kit, email-keyed, waitlist/active — granted/revoked on `/vendors`).
RLS default-deny; team-membership via `merqo.is_merqo_team()`. `products` +
`vendor_links` are read/written via the **service-role client** (server-only) so
the `metrics_secret` never reaches a browser.

## Rules (always)

- TypeScript strict — no `any`, no `@ts-ignore`.
- Validate all user input with Zod `safeParse()` at every boundary.
- Authorization lives in **RLS policies** + the service-role boundary, not app code.
- Use the **service-role client only** in Server Actions / Route Handlers.
- No secrets in `NEXT_PUBLIC_*`. `NEXT_PUBLIC_SUPABASE_*` are inlined at build.
- Cross-kit data goes over the **HTTP metrics API** (bearer secret), never a direct
  cross-schema query. Never touch qkit's `public.*` from merqo.
- After editing the schema, add a new numbered migration in `supabase/migrations/`.
- **Comments (tc 5.8):** explain WHY not what; prefer own-line, trailing sparingly
  (`no-inline-comments: warn`); no commented-out code; no change-narration
  (`was X`, `added`, dates, ticket refs — that lives in the commit); JSDoc on
  exports documents the contract, not the implementation.

## Skills

### Project skills — check here first (`.claude/skills/`)

| Skill               | What it does                              |
| ------------------- | ----------------------------------------- |
| `/next-verify`      | typecheck + lint + test in one pass       |
| `/supabase-migrate` | apply `supabase/migrations` (safety gate) |

### templateCentral plugin skills

templateCentral has **no Supabase support**. Use only the stack-agnostic ones:
`templatecentral:standards` (naming/validation drift). Do **not** run
`templatecentral:add (auth)` or `(database)` — they install better-auth / Drizzle
and will break RLS.

## AI Harness

PreToolUse: blocks secret files (exit 2): `.env*` (except `.env.example`), cert
files (`.pem`/`.key`/`.p12`/`.pfx`/`.secret`), `credentials.json`/`.netrc`/`.secrets`;
and blocks `--no-verify`. App code, skills, specs, `.github/workflows/` unrestricted.
UserPromptSubmit: pattern-checks prompts for injection phrases; exit 2 blocks.
PostToolUse: `tsc --noEmit --incremental` after every Edit/Write. Feedback-only.
Stop: exits 0 when `stop_hook_active`; else runs the test suite, exit 2 feeds
failures back. SessionStart (startup|resume|compact): re-injects the first 30 lines
of this file. `permissions`: `deny` covers secret reads/edits (`.env.local` and
other `.env.<env>` variants, `./secrets/**` — `.env.example` whitelisted) and
irreversible ops (`rm -rf`, `git push --force`/`-f`, `git reset --hard`,
`git clean -fd/-fx`, `git filter-branch`, ref-delete). `ask` gates edits to
AGENTS.md / CLAUDE.md / settings.json.
Git hooks (lefthook): pre-commit runs format/lint/typecheck + lockfile-sync
(`--frozen-lockfile`) + gitleaks secret-scan on staged files, plus a
readme-coupling staleness warning; commit-msg enforces Conventional Commits;
pre-push runs the harness integrity check + quality gate.
CI (GitHub Actions): hard gate on changed-line coverage (`diff-cover`
≥80%), lockfile-in-sync (`--frozen-lockfile`), a changelog-touched check, a
readme-freshness check, harness integrity, and a `db` job (pgTAP RLS suite).
`security.yml` runs gitleaks + `pnpm audit` — **no CodeQL** (code scanning
requires GitHub Advanced Security, unavailable on this private repo's free
tier; this line previously and incorrectly claimed CodeQL was configured).
`.github/dependabot.yml` (security-only).
Project skills (directory form, `<name>/SKILL.md`): `.claude/skills/` |
Manifest: `.claude/harness.json`

> Note: unlike the qkit reference, `settings.json` here omits the broad
> `permissions.allow` list (each session grants tools interactively). Add an
> allow-list if you want fewer prompts.

## Skills Security

- Review `SKILL.md` before installing any third-party skill — treat skills like packages.
- Scope `allowed-tools:` to the minimum (e.g. `Bash(git *)` not `Bash`).
- Never install skills that hardcode secrets or make unlisted outbound calls.

## Project-Specific Notes

- Adopted into templateCentral (`nextjs@5.8.0` Supabase variant) via
  `templatecentral:migrate` on 2026-07-06 — hand-crafted from qkit boilerplate,
  harness ported from the qkit reference. **5.7→5.8 delta + lefthook adopted:**
  comment hygiene (`no-inline-comments: warn` + the doctrine above),
  `packageManager` currency (`pnpm@11.10.0`), and lefthook (git hooks,
  replacing husky). **Not adopted** (same divergences as qkit):
  - the full tc harness-kit (bespoke CI here), pino route-logging,
    harness-verifier / `.harness-base` re-sync layer, better-auth/Drizzle.
- Landing design spec: `docs/superpowers/specs/2026-07-06-merqo-home-landing-design.md`.
- Deploy runbook: `docs/DEPLOY.md`.

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration -->
