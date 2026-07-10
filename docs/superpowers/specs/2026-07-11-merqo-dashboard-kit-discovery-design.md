# Dashboard Kit Discovery Redesign — Design

**Date:** 2026-07-11
**Status:** Approved (brainstorm)
**Scope:** Redesign `/dashboard`'s content — clearer your-kits-vs-discover-more
separation, hover polish on kit cards, richer per-kit copy, small illustrative
previews for the two kits with a real or near-term product, and a lighter
onboarding-oriented treatment on `/dashboard/pending`. Merqo repo only.

## Context

`/dashboard` (`src/app/dashboard/(app)/page.tsx`) currently renders, in order:
an active-kit tile grid ("Your kits"), a plain "Requested" waitlist list, a
plain "Add a kit" list (live kits not yet joined — `addableKits()` in
`src/lib/vendor.ts`, which only surfaces `status === "live"` kits), and a
static text link out to the landing page's `#kits` section for anything else.
`coming`/`planned` kits (`src/lib/kits.ts`'s `KITS` array — loopkit is
`coming`; shopkit/paykit/stockkit/reachkit are `planned`) are invisible on the
dashboard itself today.

`VendorKitCard` (`src/app/dashboard/(app)/vendor-kit-card.tsx`) is a static
bordered card with no hover treatment. `Kit` (`src/lib/kits.ts`) has only a
one-line `tagline`, no room for a fuller explanation.

Research into card-grid UX (Shopify/Notion/Zapier app-marketplace patterns)
confirmed the "connected tools" vs "discover more" split is standard and
should stay visually distinct, not interleaved. Research into hover
micro-interactions recommends sub-300ms transitions that reveal one CTA plus
one extra detail line — not a full content swap. Research into how real
premium products (Linear, Stripe, Vercel) illustrate their own UI found that
faking a full "screen" reads as cheap; the concrete, well-precedented building
block instead is a small `mockup-window`-style chrome frame (browser-bar dots)
wrapping a handful of **real domain objects**, styled with a shadow-as-border
card edge rather than a flat border, one accent color per kit, and no idle
animation. Research into empty-state design (Nielsen Norman Group, sourced)
supports giving a zero-kit vendor a direct actionable pathway rather than a
dead end, but does not support dropping a full multi-item catalog grid
into that empty state — a lighter, featured-item treatment is the
defensible middle ground.

## Goal

A vendor can tell at a glance what they already have, what they can add right
now, and what's coming — with enough per-kit context (and, for the two
nearest-term kits, a small visual) to understand what each kit actually does
before joining.

## Non-goals

- **No custom preview component for the 4 `planned` kits** (shopkit, paykit,
  stockkit, reachkit). They get the richer `description`/`features` copy and
  an icon, not a mockup — building a preview for a product that's still just
  a roadmap entry is premature, and this can be revisited per kit as it
  approaches `coming` status.
- **No real waitlist/interest mechanism for `planned` kits.** They have no
  `merqo.products` row today (only `live`/`coming_soon` are valid `status`
  values per migration `0001_merqo_core.sql`'s CHECK constraint) and no
  migration is in scope here to change that. `planned` kits are informational
  only on this pass.
- **No new route.** Everything stays on the existing `/dashboard` and
  `/dashboard/pending` pages — no separate "browse kits" page.
- **No full explore-grid duplication onto `/dashboard/pending`.** See the
  Pending page section below — deliberately lighter than the main dashboard's
  discovery section.

## Changes

### `src/lib/kits.ts` — data model

Add two fields to `Kit`, additive only (`tagline` stays untouched — the
landing page still uses it):

- `description: string` — 2-3 sentence explanation for the card body.
- `features: string[]` — 3-4 short "what you get" bullets.

### `src/app/dashboard/(app)/page.tsx` — page structure

Reorder/extend to, top to bottom:

1. **Your kits** — active tile grid, unchanged bucket (`tilesForLinks().active`),
   cards get the hover treatment below.
2. **Pending requests** — today's waitlist strip, unchanged, kept as a
   separate lightweight list (a status, not something to discover).
3. **Explore more kits** — new umbrella section replacing the current flat
   "Add a kit" list, split into two card-grid subsections:
   - **Ready to add** — live kits not yet joined (`addableKits()`, unchanged
     bucket logic), real "Add {kit}" CTA, unchanged mechanism.
   - **Coming soon** — `coming` (loopkit — existing real waitlist-join CTA,
     unchanged) and `planned` kits (description + icon, no CTA) together,
     visually distinguished by a badge/label so "can act now" (loopkit's
     waitlist button) reads differently from "informational only" (planned
     kits).

All card sections use `grid-cols-1 sm:grid-cols-2`, matching the existing
convention; the pending-requests strip stays a list, not a grid.

### `src/app/dashboard/(app)/vendor-kit-card.tsx` — hover treatment

Add a hover state: lift (`hover:-translate-y-0.5` or similar), shadow
increase, border-color shift, transition under 300ms. On hover, reveal the
primary CTA more prominently and surface one additional detail line (e.g. the
first `features` bullet) — not a full content swap. Keep the base (non-hover)
card legible on its own for touch/keyboard users who never trigger `:hover`.

### Preview components (new) — `src/components/dashboard/kit-previews/`

A registry (`Record<string, ComponentType>` keyed by slug) of small,
non-interactive preview components, built for **qkit and loopkit only**:

- `LoopkitPreview` — chrome frame (browser-bar dots/address pill, plain
  Tailwind, no images) wrapping a row of stamp circles, most unfilled, a few
  filled — a real domain object (a stamp card), not an imagined app screen.
- `QkitPreview` — same chrome frame wrapping a small queue-ticket/"now
  serving" representation.

Both: shadow-as-border card edge (stacked `box-shadow`, not a flat `border`),
one accent color max, static — no idle animation. These render inside the
"Ready to add" (qkit) and "Coming soon" (loopkit) cards respectively.

### `src/app/dashboard/pending/page.tsx` — lighter onboarding treatment

Currently: "You're on the list" (if any waitlist entries) or "No kits yet",
plus a static "Check again" / sign-out / back-home button stack. Add: the one
live, joinable kit (qkit today) shown with its real "Add qkit" CTA — reusing
whatever card/preview piece makes sense from the dashboard's "Ready to add"
section — plus a lightweight "more kits on the way" line linking out (to
`/#kits`, as today). Deliberately **not** the full Explore-more-kits grid from
`/dashboard` — the empty-state research supports a direct actionable pathway,
not a full catalog dump right after signup.

## Testing

- `src/lib/vendor.ts`: if bucketing logic changes (e.g. a new pure function to
  split `coming`/`planned` within the "Coming soon" subsection, or to pick the
  featured kit(s) for the pending page), each gets its own unit test,
  mirroring `addableKits`'/`hasRenderableActiveKit`'s existing coverage.
- `VendorKitCard`: DOM test for the hover-revealed detail line and CTA.
- Preview components: a lightweight render test each (they're static, so
  mostly a smoke test — renders without throwing, contains expected
  structure).
- `/dashboard` page: DOM/integration test for the three-section structure
  with a vendor that has some active, some pending, some addable kits.
- `/dashboard/pending` page: DOM test for the featured-kit CTA rendering
  alongside the existing empty/waitlist-state tests.
- `pnpm check` + `pnpm build` clean (see the account-parity spec's testing
  note — `pnpm build` specifically, not just `pnpm check`, given this
  session's CI failure was a build-only failure mode).

## Open questions

None blocking. `planned`-kit waitlist/interest mechanics and per-kit preview
components for the remaining 4 kits are deliberately deferred, not decided
against — revisit per kit as it nears `coming` status.
