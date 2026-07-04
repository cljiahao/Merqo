# Merqo Dashboard v1 — SDD Progress

Plan: docs/superpowers/plans/2026-07-04-merqo-dashboard-v1.md (in Coding/docs)
Adaptations: Phase A (qkit endpoint) DEFERRED — qkit off-limits this session; delivered as plan code for user to drop in later. Provisioning (Supabase project, secrets, db push/seed, live smoke) DEFERRED to user. Contract test uses hand-authored sample.

Task B1: complete (scaffold + supabase auth boilerplate + login; build green)
Task B2: complete (0001_merqo_core.sql + schema test 5/5; db push+seed PENDING-USER)
Task C1: complete (metrics-schema + metrics-client, 6/6)
Task C2: complete (team gate, registry read, overview totals, /team page, ProductCard + tests 4/4; build green)
Task C3: complete (contract test 2/2, hand-authored sample pending live qkit capture)
Task D1: complete (vendor.ts mergeCatalog/requireVendor/resolveVendorCatalog/addToWaitlist, 2/2)
Task D2: complete (/(vendor)/products page + join-waitlist action, 2/2; build green)
Task D3: complete (playwright config + gated smoke; full suite 21/21, tsc clean, eslint clean). Browser e2e PENDING-USER (playwright install + seeded auth).
Final review: no Critical. Fixed 2 Important — (1) 200-unparseable body now bad_shape not unreachable (+test, 22/22); (2) email lowercased in requireVendor/resolveVendorCatalog/addToWaitlist. Minor #4 (untyped casts) accepted. #3 email-confirm = PROVISIONING gate flagged to user.
