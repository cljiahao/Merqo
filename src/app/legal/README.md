# legal

## Purpose

Public legal document pages, rendering `@merqo/ui`'s shared legal content
(Terms of Service, Privacy Policy, Pilot/UAT Agreement, and an
end-customer notice), plus the acceptance interstitial vendors are
redirected to when their acceptance is stale or missing.

## Contents

- `terms/` — the Terms of Service, composed with every per-kit schedule
  appended; see its own README.
- `privacy/` — the Privacy Policy; see its own README.
- `pilot-agreement/` — a reference copy of the Pilot/UAT Agreement's
  text; see its own README.
- `end-customer-notice/` — a short, non-contractual disclosure for the
  vendor's own end customers; see its own README.
- `accept/` — the acceptance interstitial + server action; see its own
  README.

## Connectivity

`terms/`, `privacy/`, `pilot-agreement/`, and `end-customer-notice/` are
each a one-line Server Component page; none is gated. `accept/` is the
one page in this folder a signed-in vendor gets redirected to
(`requireVendorSession`, `src/lib/vendor.ts`) and is deliberately excluded
from that same gate to avoid a redirect loop. Linked from the landing
footer (`@merqo/ui`'s `LegalFooterLinks`) and from merqo's own Telegram
bot (`../api/telegram/webhook/route.ts`).

## Parent

[app](../README.md)
