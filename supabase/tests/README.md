# Database tests

Run the rollback-only pgTAP suites with `supabase test db` against local Supabase. They check database authorization and integrity, which mocked application tests cannot establish. CI's database job applies migrations before running them.

- `rls.test.sql`: table RLS, vendor/team isolation, restricted grants, uniqueness, Telegram consent RPCs, founder triggers, and avatar bucket limits.
- `metric-emitter.test.sql`: service-only metric emission and trusted trigger access.
- `vendor-profile-partial-updates.test.sql`: owner-scoped atomic partial profile writes.
- `vendor-profile-reader-permissions.test.sql`: owner/service profile creation and permitted existing reads.
- `private-helper-acl.test.sql`: private customer synchronization, owner-trigger continuity, billing service grants, and founder helper denial.

The latest prepared migrations and fixtures still need local database execution; their presence is not a passing runtime result. Keep fixed pgTAP plans aligned with assertion counts; focused suites using `no_plan()` report their count automatically.

[Repository README](../../README.md)
