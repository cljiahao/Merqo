# .claude/hooks

## Purpose

The enforcement-layer scripts `.claude/settings.json` wires up as Claude
Code hooks — kept as standalone files (not inlined `node -e` one-liners in
`settings.json`) so they're readable, testable, and integrity-checked via
`.claude/harness.json`. See `AGENTS.md`'s "AI Harness" section for the full
behavioral description of each hook and the events they're wired to.

## Contents

- `protect-files.sh` — PreToolUse(Edit|Write): hard-blocks secret/credential/
  CI-pipeline files (exit 2), asks for human approval on governance files
  (AGENTS.md/CLAUDE.md, `.claude/settings.json`, `.claude/hooks/*`,
  `.husky/*`, `.gitleaks.toml`, Dockerfile, etc).
- `block-no-verify.sh` — PreToolUse(Bash): blocks `--no-verify`/`-n`,
  hook-layer bypasses (`HUSKY=0`, `HUSKY_SKIP_HOOKS`, `core.hooksPath=…`),
  direct commits to `main`, force-pushes to `main`, `checkout`/`restore` of
  guard-layer files, and recursive-forced `rm` on source directories.
- `user-prompt-guard.cjs` — UserPromptSubmit: pattern-checks prompts for
  injection phrases (OWASP LLM01) and embedded credentials (OWASP LLM02);
  exit 2 blocks.
- `post-edit-typecheck.sh` — PostToolUse(Edit|Write): runs
  `tsc --noEmit --incremental` on TS edits, feedback-only.
- `post-tool-failure.sh` — PostToolUseFailure: surfaces tool-error context,
  always exits 0.
- `skill-usage-log.sh` — PostToolUse(Skill\_\_.\*): appends to
  `.claude/skill-usage.log`.
- `stop-checks.sh` — Stop: exits 0 when `stop_hook_active`; else runs
  `pnpm test --run`, exit 2 feeds failures back.
- `subagent-stop.sh` — SubagentStop: type-gates a subagent's uncommitted TS
  changes before it hands back control.
- `session-context.sh` — SessionStart (startup|resume|clear|compact):
  re-injects the first 30 lines of `AGENTS.md` plus always-on invariants.
- `verify.sh` — manual verification gate (`pnpm build && pnpm check &&
  pnpm test`), not wired to a Claude Code hook event; run by hand after
  substantial changes. Distinct from `.claude/verify-harness.sh`, the
  harness-manifest drift check wired into `.husky/pre-push` and CI.

## Parent

[.claude](../README.md)
