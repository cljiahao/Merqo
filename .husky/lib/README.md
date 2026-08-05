# .husky/lib

## Purpose

The real logic behind each thin `.husky/*` hook dispatcher. Husky's
dispatcher runs hook files via POSIX `sh -e`, which ignores a `bash`
shebang and doesn't support `set -o pipefail` — so the actual `bash` logic
lives here instead of directly in the hook files husky invokes.

## Contents

- `pre-commit.sh` — pre-commit body: `prettier --write` + `eslint --fix
--max-warnings=0` on staged `.ts/.tsx/.js/.mjs/.cjs` (excluding
  `.claude/hooks/*` and `.claude/.harness-base/**`, and re-staging with
  `xargs -d '\n'` so filenames with spaces/quotes survive), `tsc --noEmit`,
  a frozen-lockfile install check when `package.json` is staged, a gitleaks
  secret-scan on staged files (if gitleaks is installed), then the
  README-coupling (`readme-coupling.sh`) and comment-hygiene
  (`comment-hygiene.sh`) nudges.
- `pre-push.sh` — pre-push body: `.claude/verify-harness.sh` (integrity
  check) plus `pnpm run check && pnpm test`.
- `readme-coupling.sh` — pre-commit nudge (non-blocking): warns to stderr
  when staged files touch a folder whose `README.md` wasn't also staged;
  the commit still proceeds.
- `comment-hygiene.sh` — pre-commit nudge (non-blocking): warns to stderr
  when a staged `.ts/.tsx/.js/.jsx/.mjs/.cjs` file contains a
  change-narration comment or an oversized (>5-line) comment block, per
  `.claude/comment-hygiene-patterns.txt`; the commit still proceeds (CI's
  `comment-hygiene` job is the hard gate, scoped to added lines only).
- `commit-msg-check.sh` — Conventional Commits gate: validates the commit
  message's first line against
  `^(feat|fix|chore|docs|style|refactor|test|ci|perf|build|revert)(\(scope\))?: description`,
  exempting merge commits and `chore(release):`; non-zero exit rejects the
  commit.

## Parent

[.husky](../README.md)
