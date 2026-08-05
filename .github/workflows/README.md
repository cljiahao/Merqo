# workflows

## Purpose

GitHub Actions CI pipelines: `ci.yml` (harness integrity, check, unit
tests, coverage gate, build, both e2e suites, changelog gate,
README-freshness gate, comment-hygiene gate, db migrations + RLS) and
`security.yml` (gitleaks secret scan, dependency audit — no CodeQL, since
code-scanning upload requires GitHub Advanced Security, unavailable on
this private repo's free tier).

## Contents

- `ci.yml` — triggers on push to `main` and on every PR. Jobs: `test`
  ("check + unit" — harness-integrity check, `pnpm check`, `pnpm test`,
  changed-line coverage via `diff-cover` ≥80%); `build` ("build (next
  build)"); `e2e` ("e2e (public smoke)" — Playwright against the public
  landing/login flow); `e2e-admin` ("e2e (admin interaction)" — Playwright
  admin-console interaction flows against a real local Supabase instance);
  `changelog` (PR-only, `skip-changelog` bypass); `readme-freshness`
  (PR-only, `skip-readme-check` bypass); `comment-hygiene` (PR-only,
  hard-gates change-narration comments in added lines,
  `skip-comment-check` bypass); `db` ("db (migrations + pgTAP RLS)").
- `security.yml` — gitleaks secret scan + `pnpm audit`, triggered on push
  to `main`, every PR, and a weekly cron.

Every third-party action in both workflows is pinned to a full commit SHA,
not a floating version tag.

## Parent

[.github](../README.md)
