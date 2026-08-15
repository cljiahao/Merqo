<!-- templateCentral: nextjs@5.15.0 (Supabase variant — shared project, schema per kit) -->

# AGENTS.md — Merqo

> STOP — This project diverges from the stock templateCentral Next.js stack on the
> data layer only. Auth/DB are **Supabase** (`@supabase/ssr`), not better-auth +
> Drizzle. Authorization is enforced in Postgres via **RLS**. Runtime matches tc:
> Next 16, route protection in `src/proxy.ts`, and
> `cookies()`/`headers()`/`params`/`searchParams` are async.

## What Merqo is

The house brand + dashboard for a modular family of small-business tools ("kits")
for Singapore micro/small sellers. `qkit` (queue/orders), `loopkit` (stamp-card
loyalty), and `paykit` (payments) are live (see `src/lib/kits.ts`).
This app is the public brand landing + a role-gated operator console:
`/dashboard` (cross-product metrics overview, post-login home), `/admin/vendors`
(grant/revoke kit access per vendor), `/admin/team` (manage Merqo-team members),
`/admin/products` (per-kit health from the metrics API), and `/admin/feedback`
(vendor NPS + comments per kit).
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
src/app/                    — app router (landing, dashboard, admin console, server actions)
src/app/page.tsx            — public brand landing (static-prerendered)
src/app/dashboard/          — vendor dashboard: (app)/ (active-kit overview + kit discovery)
                               and pending/ (no-active-kit state)
src/app/admin/              — Merqo-team console: overview (page.tsx) + vendors/, team/,
                               products/, feedback/ (all auth-gated)
src/app/profile/            — shared account page (signed-in gate only — reachable from
                               both the vendor dashboard and the admin console)
src/app/login/              — email/password sign-in
src/proxy.ts                — Supabase session refresh + route guard (Next 16)
src/components/landing/      — landing sections (nav, hero, kit-stacker, …)
src/components/dashboard/    — dashboard widgets (stat cards, kit discovery/preview cards)
src/components/ui/           — shadcn primitives (CLI-managed, do not hand-edit)
src/hooks/use-async-action.ts — shared pending/error state for server-action buttons
src/lib/supabase/           — browser / server (schema=merqo) / service clients + mw helper
src/lib/kits.ts             — the kit family config (landing roadmap source of truth)
src/lib/metrics-client.ts   — fetch of a kit's HTTP metrics endpoint
supabase/migrations/        — SQL schema (merqo.* tables) + RLS + grants
```

## Data model

One shared Supabase project, schema per kit. Merqo owns `merqo.*`:
`merqo_team` (team membership, managed on `/admin/team`), `products` (kit registry +
per-product `metrics_secret`, surfaced on `/dashboard`), `vendor_links`
(vendor↔kit, email-keyed, waitlist/active — granted/revoked on `/admin/vendors`).
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

Hook scripts live in `.claude/hooks/` (not inlined in `settings.json`):
PreToolUse(Edit|Write) → `protect-files.sh` hard-blocks secret files (exit 2:
`.env*` except `.env.example`, cert/credential files, CI/CD pipeline
definitions, `secrets/**`) and asks for human approval on governance files
(AGENTS.md/CLAUDE.md, `.claude/settings.json`, `.claude/hooks/*`,
`.husky/*`, `.gitleaks.toml`, Dockerfile, etc). PreToolUse(Bash) →
`block-no-verify.sh` blocks `--no-verify`/`-n`, hook-layer bypasses
(`HUSKY=0`, `HUSKY_SKIP_HOOKS`, `core.hooksPath=…`), direct commits to `main`, force-pushes to
`main`, `checkout`/`restore` of guard-layer files, and recursive-forced `rm`
on source directories. App code, skills, specs unrestricted.
UserPromptSubmit → `user-prompt-guard.cjs` pattern-checks prompts for
injection phrases (OWASP LLM01) and embedded credentials (OWASP LLM02); exit
2 blocks. PostToolUse(Edit|Write) → `post-edit-typecheck.sh` runs `tsc
--noEmit --incremental` on TS edits, feedback-only, and
`post-edit-comment-check.sh` flags change-narration comments/oversized
comment blocks on TS edits (patterns from
`.claude/comment-hygiene-patterns.txt`), also feedback-only.
PostToolUse(Skill__.*) → `skill-usage-log.sh` appends to
`.claude/skill-usage.log`.
PostToolUseFailure → `post-tool-failure.sh` surfaces tool-error context,
always exits 0. Stop → `stop-checks.sh` exits 0 when `stop_hook_active`; else
runs `pnpm test --run`, exit 2 feeds failures back. SubagentStop →
`subagent-stop.sh` type-gates a subagent's uncommitted TS changes before it
hands back control. SessionStart (startup|resume|clear|compact) →
`session-context.sh` re-injects the first 30 lines of this file plus
always-on invariants.
`permissions`: `deny` covers secret reads/edits (`.env.local` and other
`.env.<env>` variants, `./secrets/**` — `.env.example`/`.env.default`
whitelisted) and irreversible ops (`rm -rf`, `git push --force`/`-f`,
`git reset --hard`, `git clean -fd/-fx`, `git filter-branch`, ref-delete).
`ask` gates edits to AGENTS.md / CLAUDE.md / settings.json / harness.json
(redundant with protect-files.sh's own ask-gate on the same files).
Git hooks (husky): pre-commit runs format/lint/typecheck + lockfile-sync
(`--frozen-lockfile`) + gitleaks secret-scan on staged files, plus a
readme-coupling staleness warning and a comment-hygiene warning (both
excluding `.claude/hooks/*` and `.claude/.harness-base/**` so they can't
flag/reformat scripts off their harness.json baseline); commit-msg enforces
Conventional Commits; pre-push runs the harness integrity check + quality
gate. Migrated 2026-08-01 off lefthook, whose unsigned `lefthook.exe`
Windows Smart App Control blocks unconditionally — see
`docs/superpowers/specs/2026-08-01-lefthook-to-husky-migration-design.md`.
CI (GitHub Actions, `ci.yml`, 8 jobs): `test` (harness integrity, changed-line
coverage via `diff-cover` ≥80%, lockfile-in-sync via `--frozen-lockfile`),
`build` (`next build`), `e2e` (Playwright public smoke), `e2e-admin`
(Playwright admin-interaction flows against a real local Supabase instance),
`changelog` (changelog-touched check), `readme-freshness` (README-coupling
check), `comment-hygiene` (hard-gates change-narration comments introduced by
a PR's added lines — `skip-comment-check` label bypasses), and `db` (pgTAP
RLS suite). Actions are pinned to commit SHAs, not floating version tags.
`security.yml` runs gitleaks + `pnpm audit` — **no CodeQL** (code scanning
requires GitHub Advanced Security, unavailable on this private repo's free
tier; this line previously and incorrectly claimed CodeQL was configured).
`.github/dependabot.yml` (security-only).
Project skills (directory form, `<name>/SKILL.md`): `.claude/skills/` |
Manifest: `.claude/harness.json` (`templatecentral_version: 5.14.0`) — all 26
`seeded_files` entries carry real `origin_hash` values (no `<pending>`
markers); `verify-harness.sh` checks the subset under its guard regex
(`.claude/hooks/`, `.claude/settings.json`, `.claude/(verify|regen)-harness.sh`,
`.husky/`, `.gitleaks.toml`, `.github/workflows/`) against
the git blob at HEAD on every pre-push and in CI.

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
- **husky migration (2026-08-01):** superseded the 2026-07-24 (repo-local:
  see the lefthook-adoption bullet above) git-hook decision — lefthook's
  `lefthook.exe` is unsigned and Windows Smart App Control blocks it
  unconditionally on this machine, with no signed-binary alternative
  available in any distribution channel. husky v9 has no native binary.
  Same checks ported into `.husky/*` shell scripts; see
  `docs/superpowers/specs/2026-08-01-lefthook-to-husky-migration-design.md`.
- Landing design spec: `docs/superpowers/specs/2026-07-06-merqo-home-landing-design.md`.
- Deploy runbook: `docs/DEPLOY.md`.
- **5.14→5.15 delta reviewed (2026-08-15):** adopted `eslint.config.mjs`'s
  switch from one hand-picked sonarjs rule to `sonarjs.configs.recommended`
  (real findings fixed, see PR history) and the `next`/`eslint-config-next`
  `^16.2.12` version floor. Also added `next.config.ts`'s `headers()` (a
  genuine pre-existing gap, not a documented divergence — see the
  headers()-gap PR), built with 5.15's dev-mode CSP/`X-Frame-Options` fix
  already applied (`frame-ancestors`/`X-Frame-Options` only in
  non-development, learned from the bug report rather than reproduced fresh).
  **Not adopted:** `harness-kit.md`'s hook-`command` string→`args[]` array
  form — real and low-risk, but changing `.claude/settings.json` requires
  updating its `origin_hash` in `harness.json`, and `regen-harness.sh` is
  explicitly human-run-only (an agent re-blessing its own baseline defeats
  the drift check) — left for a human to pick up manually. Same standing
  divergences as 5.11→5.14 (full tc harness-kit, pino route-logging,
  better-auth/Drizzle) still apply. This PR itself only touches `.claude/`
  and this file — `skip-readme-check` applied, no per-folder README content
  actually changed.

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration -->
