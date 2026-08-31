# dashboard

## Purpose

Shared logic for `/dashboard` that doesn't belong to any one route group —
sits alongside `(app)/` (the dashboard itself, open to every signed-in user)
and `profile/` (the `AccountMenu`-link redirect shim).

## Contents

- `tour-actions.ts` — `markTourSeen()`: a `"use server"` action, fired
  client-side by `DashboardTour`'s `onFirstSeen` as soon as the onboarding
  tour auto-runs. Best-effort and fire-and-forget (a failure is logged but
  never surfaced), so it's not the only place the write happens — see
  `src/lib/tour-prefs.ts` and `(app)/layout.tsx`'s own server render for the
  durable, race-proof stamp this action alone can't guarantee.
- `tour-actions.test.ts` — asserts the upsert shape and the no-op-when-
  signed-out and swallowed-error paths.

## Connectivity

`tour-actions.ts` is called from `@merqo/ui`'s `DashboardTour` (mounted in
`(app)/layout.tsx`) via `src/components/dashboard-tour.tsx`'s adapter. See
the repo root README's onboarding-tour paragraph for why this client-fired
path is paired with a synchronous server-render stamp rather than relied on
alone.

## Parent

See the repo root [README.md](../../../README.md) for the full `src/app/`
layout.
