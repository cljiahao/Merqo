# .husky

## Purpose

The git-hook layer (husky v9 — no native binary, so nothing for Windows
Smart App Control to block, unlike lefthook's unsigned `lefthook.exe`).
`pnpm install`'s `prepare` script runs `husky`, which points
`core.hooksPath` at this directory.

## Contents

- `pre-commit` — thin dispatcher: `exec bash .husky/lib/pre-commit.sh "$@"`.
- `commit-msg` — thin dispatcher: `exec bash .husky/lib/commit-msg-check.sh
  "$1"`.
- `pre-push` — thin dispatcher: `exec bash .husky/lib/pre-push.sh "$@"`.
- `lib/` — the real script bodies the three dispatchers above hand off to
  (see `lib/README.md`).

## Connectivity

Husky invokes `pre-commit`/`commit-msg`/`pre-push` directly by name — no
central config file (unlike lefthook's `lefthook.yml`). Husky's own
dispatcher runs each hook file via POSIX `sh -e`, ignoring the file's
`#!/usr/bin/env bash` shebang — so every hook here is a one-line
`exec bash .husky/lib/<name>.sh "$@"` wrapper that immediately hands off to
a real `bash` script in `lib/` (plain `sh`/dash doesn't support
`set -o pipefail`, which the real logic relies on). `commit-msg` passes
husky's message-file path straight through as `$1`, a plain argv element —
no templating to mis-quote. `pre-push` separately runs
`.claude/verify-harness.sh` and the full `pnpm run check && pnpm test`
gate. `.claude/verify-harness.sh` treats every file in this folder (and
`lib/`) as part of the integrity-checked enforcement layer recorded in
`.claude/harness.json`.

## Parent

[merqo](../README.md)
