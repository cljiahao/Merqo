# legal-status

## Purpose

A kit's own `legal-gate.ts` calls this to decide whether its
acceptance gate should fire — "what's the latest version of each doc
this email has accepted?"

## Contents

- `route.ts` — `GET(request)` with a required `email` query param.
  `401`s without a valid `customerNotifySecretOk` bearer, `400`s without
  `email`. Reads `merqo.legal_acceptances` filtered by the lowercased
  email, selecting `doc_type, doc_version, accepted_at` and ordering by
  `accepted_at` descending (NOT `doc_version` — a plain string sort would
  only be correct while every `doc_version` happens to be an
  ISO-date-shaped string, which the schema doesn't enforce; this exact
  bug was caught and fixed once already). Returns `{ terms: string|null,
privacy: string|null, pilot: string|null }` — the latest accepted
  version per doc type, `null` if never accepted.
- `route.test.ts` — covers the 401/400 paths and, specifically, a
  multi-row-per-doc-type case proving the response reflects the row with
  the latest `accepted_at`, not the highest `doc_version` string
  (asserting `.order()` was actually called with `accepted_at`, not just
  that the response happens to look right against pre-sorted fixture
  data).

## Connectivity

Called by each of the 5 kits' own `legal-gate.ts`, cached locally per
kit (a `legal_check_state` table, short TTL) so this isn't hit on every
request. Reads `merqo.legal_acceptances` (migration `0024`).

## Parent

[merqo](../README.md)
