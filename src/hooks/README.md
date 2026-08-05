# hooks

## Purpose

React client hooks shared across the dashboard, admin console, and profile
forms.

## Contents

- `use-async-action.ts` — `useAsyncAction()`: a `pending` flag for an async
  handler that always resets, even on throw. Thin adapter over `@merqo/ui`'s
  `useAsyncAction` (which binds one action at hook-creation time), bound
  here to "call whatever closure you're given" so it reproduces this hook's
  original per-call-dynamic-closure shape (`run(async () => { … })` per
  call) — every existing call site keeps working unchanged. Also re-exports
  `@merqo/ui`'s `navigatingAway()` helper for a success-and-navigate branch
  that should hold `pending` true until the route unmounts.
- `use-async-action.test.tsx` — RTL tests: idle/pending/resolved states, a
  rejecting handler still clearing `pending` and re-throwing, and the
  additive `error`/`reset()` fields.

## Parent

See the repo root [README.md](../../README.md) for the full `src/` layout.
