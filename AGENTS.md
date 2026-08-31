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
cross-schema query. As of the customer Telegram-connect work (2026-08-16), merqo
is also the **receiving** side of a kit → merqo HTTP call for the first time: it
hosts its own Telegram bot (`/api/telegram/webhook`) plus bearer-secret endpoints
(`/api/merqo/customer-connect-token`, `/api/merqo/notify-customer`) that qkit and
loopkit call so a customer can connect once and get transactional order/reward
notifications across every kit they interact with. As of Phase A2 (also
2026-08-16), that same bot ALSO serves each vendor's own activity alerts —
`/api/merqo/vendor-connect-token`/`/api/merqo/notify-vendor` — superseding
qkit's and loopkit's own separate per-kit vendor-alert bots (now retired on
their side); a vendor connects once from merqo's own `/profile` page. See
"Data model" below,
`docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md`, and
`docs/superpowers/specs/2026-08-16-vendor-telegram-connect-design.md`.

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
src/app/dashboard/          — vendor dashboard: (app)/ (overview + kit discovery),
                               open to every signed-in user (requireVendorSession)
src/app/admin/              — Merqo-team console: overview (page.tsx) + vendors/, team/,
                               products/, feedback/ (all auth-gated)
src/app/profile/            — shared account page (signed-in gate only — reachable from
                               both the vendor dashboard and the admin console)
src/app/login/              — email/password sign-in
src/app/api/telegram/webhook/ — merqo's own Telegram bot's webhook (customer + vendor connect,
                               branches on telegram_link_tokens.kind)
src/app/api/merqo/          — bearer-secret endpoints qkit/loopkit call INTO merqo
                               (customer-connect-token, notify-customer, vendor-connect-token,
                               notify-vendor)
src/proxy.ts                — Supabase session refresh + route guard (Next 16)
src/components/landing/      — landing sections (nav, hero, kit-stacker, …)
src/components/dashboard/    — dashboard widgets (stat cards, kit discovery/preview cards)
src/components/ui/           — shadcn primitives (CLI-managed, do not hand-edit)
src/hooks/use-async-action.ts — shared pending/error state for server-action buttons
src/lib/supabase/           — browser / server (schema=merqo) / service clients + mw helper
src/lib/kits.ts             — the kit family config (landing roadmap source of truth)
src/lib/metrics-client.ts   — fetch of a kit's HTTP metrics endpoint
src/lib/telegram.ts         — sendTelegramMessage + generateLinkToken (Bot API, no SDK)
src/lib/qr.ts                — qrSvg: renders a Telegram deep link as inline QR SVG markup
src/lib/customer-notify-auth.ts — customerNotifySecretOk bearer guard (kit → merqo calls,
                               both customer- and vendor-facing routes)
supabase/migrations/        — SQL schema (merqo.* tables) + RLS + grants
```

## Data model

One shared Supabase project, schema per kit. Merqo owns `merqo.*`:
`merqo_team` (team membership, managed on `/admin/team`), `products` (kit registry +
per-product `metrics_secret`, surfaced on `/dashboard`), `vendor_links`
(vendor↔kit, email-keyed, waitlist/active — granted/revoked on `/admin/vendors`),
`vendor_sync_state` (`0023`, per-email kit-sync throttle marker, service-role only).
RLS default-deny; team-membership via `merqo.is_merqo_team()`. `products` +
`vendor_links` are read/written via the **service-role client** (server-only) so
the `metrics_secret` never reaches a browser.

**Customer Telegram identity (0019, 2026-08-16):** `customers` (0018) was widened
— surrogate `id` PK, `phone` now nullable, plus `telegram_chat_id`/
`consent_given_at`/`pending_notify_ref` and a `customers_identity_check`
constraint (phone or telegram_chat_id, not neither) — so a customer can connect
via Telegram alone, with no phone number. RLS enabled, zero policies, no
table-level grant to anyone: every access path is a SECURITY DEFINER RPC —
`upsert_customer` (0018, phone-keyed), plus three new ones (`upsert_customer_telegram`,
`claim_customer_by_notify_ref`, `find_customer_telegram_by_phone`), all
`service_role`-only with `EXECUTE` explicitly revoked from `PUBLIC` (none of
the three has an in-body caller check the way `upsert_vendor_profile` does —
the HTTP-layer bearer check below is the only gate). `telegram_link_tokens`
(0019, widened by 0020's `kind` column) is RLS-enabled, zero client policies,
`service_role`-only, same shape as every other `*_link_tokens` table in this
ecosystem.

**Vendor Telegram connect, Phase A2 (0020, 2026-08-16):** consolidates qkit's
and loopkit's own separate per-kit vendor-alert bots onto this same shared
bot — see the master doc's "Phase A2" section for why this supersedes Phase
A. `telegram_link_tokens` gets a `kind` column (`'customer'` default-backfilled
for every pre-0019 row, or `'vendor'`; `notify_ref`/`kit_slug` now nullable —
a standing vendor link has no single order to scope to) so the webhook's
`/start` handler can resolve either kind. New `vendor_telegram` table
(`vendor_id` PK — the shared `auth.users.id` every kit already keys on, no
widened-identity substrate needed here unlike `customers` above): RLS
enabled, own-row `select` policy (`vendor_id = (select auth.uid())`) plus a
table-level `select` grant to `authenticated`, no client write grant — every
write goes through the service-role client (the webhook route on link, the
profile page's `disconnectVendorTelegram` action). No migration path for an
already-linked vendor — a Telegram `chat_id` is scoped to a (bot, user) pair,
so a vendor's old `chat_id` under qkit's/loopkit's now-retired bots is
meaningless under merqo's bot; they see the connect flow again next time
they visit `/profile`, same as a vendor who never linked.

**kit → merqo HTTP (new direction, 2026-08-16):** every other cross-kit call in
this codebase flows merqo → kit (metrics pull, vendor-provision). The customer
Telegram-connect flow was the first exception, and Phase A2's vendor pair
followed the same shape — qkit and loopkit call INTO merqo, gated by
`customerNotifySecretOk` (`src/lib/customer-notify-auth.ts`), a
constant-time check of `Authorization: Bearer <MERQO_CUSTOMER_SECRET>` — one
shared-secret value known by merqo and every participating kit, same simple
pattern `MERQO_METRICS_SECRET` already uses in the opposite direction. See
`docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md` and
`docs/superpowers/specs/2026-08-16-vendor-telegram-connect-design.md`.

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
  better-auth/Drizzle) still apply.
- **Customer Telegram connect, Phase B+D (2026-08-16):** merqo's own third
  Telegram bot (`src/app/api/telegram/webhook/route.ts`), distinct from
  qkit's and loopkit's own Phase A vendor-alert bots, plus two
  bearer-secret endpoints (`src/app/api/merqo/customer-connect-token/`,
  `src/app/api/merqo/notify-customer/`) that qkit and loopkit call —
  **the first kit → merqo HTTP direction in this codebase** (every other
  cross-kit call flows merqo → kit). `notify-customer` has two mutually
  exclusive lookup modes: `notify_ref` (qkit's "waiting" flow, single-use —
  clears `pending_notify_ref` atomically on send) and `phone` (loopkit's
  reuse-only flow — a standing connection, never cleared). See the "Data
  model" section above for the schema, and
  `docs/superpowers/specs/2026-08-16-customer-telegram-connect-design.md`
  for the full design (including the PDPA-researched consent model). This
  must merge and deploy (env vars set, `setWebhook` called — see
  `docs/DEPLOY.md`) before qkit's and loopkit's own customer-telegram-connect
  plans can be implemented against real endpoints.
- **Vendor Telegram connect, Phase A2 (2026-08-16):** consolidates Phase A's
  vendor activity alerts (qkit's order alerts, loopkit's reward alerts) off
  their own separate per-kit bots and onto this same shared bot. Two new
  bearer-secret endpoints (`src/app/api/merqo/vendor-connect-token/`,
  `src/app/api/merqo/notify-vendor/`), a `kind` column on
  `telegram_link_tokens` the webhook route branches on, a new
  `merqo.vendor_telegram` table, and a new `VendorTelegramSection` component
  in `@merqo/ui` (bumped to v0.15.0) wired into `src/app/profile/`. No new
  bot/env-var setup needed — reuses the already-live `TELEGRAM_BOT_TOKEN`/
  `TELEGRAM_WEBHOOK_SECRET` from Phase B+D. **Every vendor who'd previously
  linked qkit's or loopkit's own bot must reconnect once via merqo's profile
  page** — an expected, already-approved consequence of retiring those bots
  (Telegram's `chat_id` is scoped to a (bot, user) pair, so the old link is
  meaningless under a different bot), not a migration bug. See the "Data
  model" section above and
  `docs/superpowers/specs/2026-08-16-vendor-telegram-connect-design.md`.
  This must merge and deploy before qkit's and loopkit's own Phase A2 plans
  can retire their local bots against a real endpoint.

<!-- [[post-harness]] — reserved for trace capture and meta-harness integration -->
