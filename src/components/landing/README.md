# landing

## Purpose

The public brand landing page (`src/app/page.tsx`), broken into one section
per file. Presentational only — no data fetching, no client state beyond the
`authed` prop threaded down from the page for the nav/CTA sign-in links.

## Contents

- `nav.tsx` — sticky top nav built on `@merqo/ui`'s shared `LandingNav` shell
  (`wordmark`/`end` slots): `Wordmark` as the wordmark slot, a `#faq` anchor
  link + a sign-in/dashboard link (`Sign in` when signed out, `Go to
dashboard` when signed in) as the end slot. Header padding/logo size
  (`px-5 py-4`, `text-3xl`) matches qkit's landing nav exactly.
- `hero.tsx` — headline, stat row, CTA.
- `benefits.tsx` — the "why Merqo" feature grid.
- `kit-stacker/` — the interactive kit-stacking demo.
- `how-it-works.tsx` — step-by-step explainer.
- `faq.tsx` — static Q&A list.
- `footer.tsx` — single-row site footer matching qkit's landing footer
  exactly — `Wordmark`, tagline, `© <year> Merqo` credit line (no "· a
  Merqo kit" suffix — Merqo is the parent, per the landing-page standard),
  `Sign in →` link. No bottom call-to-action band above it (removed to
  match qkit, which never had one).
- `footer.test.tsx` — asserts the wordmark link, tagline, copyright line,
  and sign-in link all render.
- `waitlist-form.tsx` — email capture for kits not yet live.
- `wordmark.tsx` — the "Merqo" brand mark.
- `back-to-top.tsx` — fixed-position scroll-to-top button (ported from
  qkit), shown past a scroll threshold.

## Connectivity

Assembled by `src/app/page.tsx` in the order listed above (nav → hero →
benefits → kit-stacker → how-it-works → faq → footer →
back-to-top), plus a sticky mobile CTA bar rendered directly in `page.tsx`.

## Parent

[components](../README.md)
