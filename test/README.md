# test

## Purpose

Vitest test suite root: shared setup plus test files that aren't colocated
with their source (mirrored by name/path under `app/`, `components/`,
`contract/`, `db/`, `lib/`).

## Contents

- `setup.ts` — global Vitest setup (`vitest.config.ts`'s `setupFiles`):
  loads `@testing-library/jest-dom/vitest` matchers and raises
  `@testing-library/react`'s `waitFor`/`findBy*` default timeout
  (`asyncUtilTimeout`) to 10s, matching `testTimeout`, so async assertions
  don't flake under CI's parallel load.
- `app/` — tests for `src/app/**` pages/components not colocated with source.
- `components/` — tests for `src/components/**` components not colocated with source.
- `contract/` — cross-kit HTTP contract tests (e.g. qkit metrics API).
- `db/` — schema/migration/RLS-shape tests.
- `lib/` — tests for `src/lib/**` modules not colocated with source.

## Parent

See the repo root [README.md](../README.md) for the full test layout.
