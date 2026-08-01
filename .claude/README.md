# .claude

Claude Code project configuration for merqo — hooks, skills, and the
templateCentral harness manifest. See `AGENTS.md`'s "AI Harness" section for
the full behavioral description of every hook and gate; this file is just a
map of what lives where.

## Contents

- `settings.json` — hook wiring (PreToolUse/PostToolUse/Stop/SubagentStop/
  SessionStart) and `permissions.allow/ask/deny`.
- `hooks/` — the scripts `settings.json` wires up: `protect-files.sh`,
  `block-no-verify.sh`, `user-prompt-guard.cjs`, `post-edit-typecheck.sh`,
  `post-tool-failure.sh`, `stop-checks.sh`, `subagent-stop.sh`,
  `session-context.sh`, `skill-usage-log.sh`.
- `skills/` — project-local skills (`next-verify`, `supabase-migrate`) that
  templateCentral's own skill set doesn't cover (this repo's data layer is
  Supabase, not Drizzle).
- `harness.json` — the templateCentral-seeded-file manifest (`origin_hash`
  per file, `templatecentral_version`), checked by `verify-harness.sh` on
  every pre-push and in CI.
- `verify-harness.sh` / `regen-harness.sh` — drift check / human-run baseline
  regen for the files listed in `harness.json` (most recently re-run
  2026-08-01 after the `.husky/lib/pre-commit.sh` `xargs -d` → `xargs -0`
  portability fix).

## Parent

[merqo](../README.md)
