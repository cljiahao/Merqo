# scripts

## Purpose

Founder-run maintenance scripts — not wired into CI or any hook, run by
hand.

## Contents

- `check-legal-version-skew.mjs` — asserts all 6 app repos (`merqo` +
  the 5 kits, siblings under the workspace root) pin the identical
  `@merqo/ui` release tag. Guards the plan's own rule that a legal-doc
  content bump must roll out to every repo the same day — a kit left on
  an older tag would show a vendor different legal text than the one
  they actually accepted. Exits `1` (with the mismatched versions
  printed) if any repo disagrees, `0` if all match. Run via `pnpm run
check:legal-versions`.

## Parent

[merqo](../README.md)
