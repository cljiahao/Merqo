# dashboard

## Purpose

Components specific to the vendor dashboard (`/dashboard`) — kit activation,
discovery cards, and stat tiles — as distinct from `src/components/landing/`
(marketing) and `src/app/admin/`'s own local components.

## Contents

- `activate-kits-button.tsx` — `ActivateKitsButton`: calls
  `activateKitsAction` for one or more kit slugs, merges each retry's result
  into a running per-kit outcome list (keyed by slug so a retry replaces
  its kit's prior entry instead of duplicating it), and toasts success/
  failure via `sonner`.
- `activate-kits-button.test.tsx` — unit tests for the merge/retry logic
  above.
- `join-waitlist-button.tsx` — `JoinWaitlistButton({ slug, kitName })`:
  calls `joinWaitlistAction` for a "planned" kit with no real activation
  path yet, toasts confirmation.
- `kit-discovery-card.tsx` — `KitDiscoveryCard({ kit, cta })`: the one
  discovery-bucket card used across all three of `/dashboard`'s "Explore
  more kits" subsections (Ready to add / Coming soon / Planned). `cta` is
  omitted entirely for planned kits (no real action exists for them yet).
- `kit-previews/` — `KIT_PREVIEWS`: a slug-keyed map of small, real (not
  faked) per-kit preview components (`qkit-preview.tsx`, `loopkit-preview.tsx`)
  each wrapped in `mockup-window.tsx`'s browser-chrome frame, shown on the
  discovery cards above.
- `stat-card.tsx` — `StatCard({ label, value, accent?, icon?, trend? })`:
  wraps `@merqo/ui`'s shared `StatTile`/`DeltaPill` content in merqo's own
  bordered/hover-lift card shell. The icon slot and 3-state trend
  (up/down/flat) don't fit `DeltaPill`'s 2-state up/down contract, so they
  compose via `StatTile`'s generic `deltaSlot`/`valueTrailing` props
  instead of being flattened into the shared component. Used by
  `src/app/admin/page.tsx`'s summary tiles.
- `stat-card.dom.test.tsx` — RTL tests: label/value render, icon presence,
  up/down/flat trend coloring, no trend output when `pct` is null, accent
  coloring on the value.

## Parent

See the repo root [README.md](../../../README.md) for the full `src/` layout.
