# test/components

## Purpose

RTL/jsdom tests for `src/components/*` and `src/components/dashboard/*`
components that aren't colocated with their source (mirrors `src/components`'
non-`dashboard/`/`landing/` and `dashboard/` files by name, not by full
path).

## Contents

- `activate-kits-button.test.tsx` — `src/components/dashboard/activate-kits-button.tsx`'s one-click kit activation flow.
- `join-waitlist-button.test.tsx` — `src/components/dashboard/join-waitlist-button.tsx`'s waitlist-join flow.
- `kit-discovery-card.test.tsx` — `src/components/dashboard/kit-discovery-card.tsx`'s card rendering per kit status.
- `kit-previews.test.tsx` — the `src/components/dashboard/kit-previews/` mockup-window preview components.
- `providers.test.tsx` — `src/components/providers.tsx`'s app-wide client providers.
- `resolve-support-message-button.test.tsx` — `src/app/admin/resolve-support-message-button.tsx`'s resolve-and-refresh flow.

`account-menu.test.tsx`, `feedback-form.test.tsx`, and `support-form.test.tsx`
were removed here: `AccountMenu` now composes `@merqo/ui`'s shared
`AccountMenu` (its own colocated `src/components/account-menu.test.tsx`
covers Merqo's adapter logic), and the local `FeedbackForm`/`SupportForm`
components it used to open in Sheets are gone entirely — `@merqo/ui` owns
that Sheet chrome directly now.

## Parent

See the repo root [README.md](../../README.md) for the full test layout.
