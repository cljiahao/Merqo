# Merqo Landing — Interactive Kit Stacker

**Date:** 2026-07-06
**Status:** Approved (brainstorm)
**Scope:** Replace the landing's static kit-tray + "how it works" sections with an
interactive "kit stacker" — the moat (stackable modules) made playable. Hero,
benefits, CTA, nav, footer stay. Also serves the declutter goal (one interactive
section replaces two wordy static ones).

## Goal

A visitor lands and immediately _sees how the kits integrate_ by clicking modules
and watching them snap into a connected graph. Communicates the ecosystem/moat,
shows what's live vs coming, and is the memorable, eye-catching centerpiece.

## Concept

Two-column section, roughly one viewport tall.

- **Left (~60%) — graph canvas** (inline SVG). `qkit` is pre-placed at center — it's
  live and it's the hub every kit flows through.
- **Right (~40%) — module list**, grouped **Live → Coming → Planned**. That grouping
  _is_ the roadmap/timeline. Each module is a clickable toggle.

Clicking a module animates its node into the graph and draws its connecting
edge(s) with a plain-language label. Clicking again removes it. **Stack all**
assembles the full 5-kit ecosystem; **Reset** returns to just qkit. Selecting all
five shows every integration (complete connected graph).

## Content — modules + relationships

Static config (extends `src/lib/kits.ts` or a new `src/lib/ecosystem.ts`).

**Modules (5, curated for a clean graph):**

| slug    | name             | status  | role                     |
| ------- | ---------------- | ------- | ------------------------ |
| qkit    | Queue & orders   | live    | hub (center, pre-placed) |
| loopkit | Loyalty & points | coming  | spoke                    |
| shopkit | Online store     | coming  | spoke                    |
| tapkit  | Payments         | planned | spoke                    |
| slotkit | Appointments     | planned | spoke                    |

**Edges (directional where it reads naturally; each carries a short label):**

- `shopkit → qkit` — "Online orders drop into your queue"
- `slotkit → qkit` — "Bookings join the same queue"
- `qkit → loopkit` — "Finished orders earn points"
- `tapkit ↔ qkit` — "Take payment as the order's placed"
- `tapkit ↔ shopkit` — "Checkout on your store"

An edge renders only when **both** its endpoints are stacked. qkit is always
present, so any single spoke shows at least its qkit edge.

## Interaction

- **State:** a `Set<slug>` of stacked kits, seeded with `qkit`. Client component.
- **Toggle:** click module card ⇄ node in/out. qkit cannot be removed (anchor).
- **Stack all / Reset** buttons.
- **Hover/focus a node** → highlight its edges + dim the rest.
- **Coming/planned nodes + their module cards** carry an inline **Notify me**
  (waitlist) — preserves the existing `joinKitWaitlist` capture. The waitlist
  action + `merqo.vendor_links` seeding are unchanged.
- **Node status visuals:** qkit = solid pine fill + gold LIVE ring; coming =
  outlined; planned = dashed/ghost.

## Visual (Control Room system)

- Neutral canvas; **pine** edges + node accents; **gold** reserved for LIVE + value.
- Nodes: rounded pill/card with the mono kit slug + short name. Curated fixed
  positions (hub-and-spoke) — not a physics layout.
- Edges: thin curved SVG paths; **animated draw-in** via `stroke-dashoffset`;
  a small label chip at the path midpoint (revealed on stack / hover to avoid
  spaghetti). Calm, not gimmicky.
- Bricolage display for the section heading; Geist body; Geist Mono for slugs.

## Timeline

A slim horizontal track under the graph: `qkit (live · now) → loopkit → shopkit →
tapkit → slotkit`, with a "you are here" marker on qkit. Reinforces sequencing +
what's shippable today. Purely presentational (reads from the same config order).

## Accessibility

(Refined against the research brief; interactive SVG a11y is the risk area.)

- The graph has a text-equivalent: a visually-hidden list describing each stacked
  kit + its connections, kept in sync with state.
- Module toggles are real `<button>`s with `aria-pressed`; keyboard-operable;
  visible focus.
- SVG marked `role="img"` (or `img`-group) with a `<title>`/`<desc>`; nodes are
  not the primary control surface — the right-side buttons are (progressive +
  accessible). Node hover is an enhancement, not the only path.
- `prefers-reduced-motion`: skip edge-draw + node-entrance animation; render final
  state immediately.
- Contrast ≥4.5:1 for labels; edges/nodes meet non-text 3:1.

## Mobile

- Single column: graph on top, module list below.
- On small screens the graph renders the **full pre-assembled ecosystem** as a
  clean static diagram (all edges), and taps highlight — no fussy stacking on a
  small canvas. The list still shows status groups + Notify me.

## Architecture / components

- `src/lib/ecosystem.ts` — `KIT_NODES` (slug, name, status, x, y) + `KIT_EDGES`
  (from, to, label, directional?). Pure data; unit-tested (edge endpoints resolve
  to real nodes; every node reachable when all stacked).
- `src/components/landing/kit-stacker/` —
  - `kit-stacker.tsx` (client) — owns the `Set<slug>` state + Stack all/Reset.
  - `graph-canvas.tsx` — the SVG (nodes + edges + timeline), driven by props.
  - `module-list.tsx` — the right-side grouped toggles + Notify me.
  - `stacker-a11y-summary.tsx` — the visually-hidden text equivalent.
- `src/app/page.tsx` — swap `<KitGrid/>` + `<HowItWorks/>` for `<KitStacker/>`.
- Remove `kit-grid.tsx`, `kit-card.tsx`, `how-it-works.tsx` (superseded). Keep
  `waitlist-form.tsx` (reused by the module cards).

## Performance

- Server page; `KitStacker` is a lean client island. Inline SVG (~5 nodes, trivial).
- No graph/animation library — hand-rolled SVG + CSS transitions. Zero new deps.
- Final DOM small; no layout thrash (transform/opacity + stroke-dashoffset only).

## Testing

- Unit: `ecosystem.ts` config (edges reference real nodes; qkit present; full-stack
  connectivity). Keep the existing `kits.test.ts` waitlist config or fold in.
- Component (jsdom): toggling a module adds/removes it from the a11y summary;
  Stack all selects all; qkit can't be removed.
- e2e smoke: the landing renders the stacker + "Stack all" control.
- Keep `pnpm check` + build green.

## Out of scope

- Drag-to-arrange, saving a stack, per-kit deep detail pages. Node positions are
  curated, not user-movable.
