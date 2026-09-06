# legal-accept

## Purpose

A kit's own `accept` server action calls this once a vendor submits the
legal-acceptance form, to record the acceptance in
`merqo.legal_acceptances`. merqo's own equivalent action inserts directly
via the service-role client instead — this endpoint exists for the 5
kits, which have no direct access to merqo's schema.

## Contents

- `route.ts` — `POST(request)`. `401`s without a valid
  `customerNotifySecretOk` bearer. Body (Zod): `{ vendor_email, auth_uid?,
doc_type, doc_version, doc_sha256, kit_slug, legal_name, ip?,
user_agent? }` — `legal_name` is required (the accepting vendor's typed
  legal name; the whole point of this table is an evidentiary record of
  who accepted what). `ip`/`user_agent` are optional: a well-behaved
  caller forwards the vendor's real request headers (read via `headers()`
  in its own server action, since it's invoked directly by the vendor's
  browser submission); if omitted, falls back to this request's own
  headers (the caller's server-to-server values — meaningful only as a
  last resort, not the vendor's real IP). Inserts one row via the
  service-role client; a `23505` unique-constraint violation
  (`vendor_email, doc_type, doc_version`) is treated as success
  (idempotent), any other insert error is a `500`.
- `route.test.ts` — covers the 401 path, missing/malformed body `400`s
  (including a missing `legal_name`), a successful insert genuinely
  carrying `legal_name`/`ip`/`user_agent` in the insert payload, and the
  `23505`-is-success path.

## Connectivity

Called by each of the 5 kits' own `/legal/accept` server action, once per
doc type (`terms`, `privacy`) — never batched into one call, so a
conflict on one doc can't block the other from being recorded. Writes
`merqo.legal_acceptances` (migration `0024`, `legal_name` column added in
`0027`).

## Parent

[merqo](../README.md)
