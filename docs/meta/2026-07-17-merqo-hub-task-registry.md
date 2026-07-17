# merqo hub — Task Registry (2026-07-17)

merqo hub's first standing backlog. Before this doc, every known gap
existed only as a "non-goal" or "out of scope" line buried inside an
individual feature spec — nothing tying them together, no priority, no
owner. Confirmed via a 2026-07-17 repo survey: **15/15 planned pieces are
shipped** (admin console, vendor portal, self-serve kit toggle, kit
discovery, feedback/support, cross-kit signal log, shared vendor profile)
— merqo hub is ahead of where the wider ecosystem roadmap assumed. What's
below is the genuine remainder, not a hidden backlog of unfinished work.

## P1 — blocks a real public launch

### T1. Domain placeholder still unfilled

`docs/DEPLOY.md:56` — `NEXT_PUBLIC_BASE_URL = https://<merqo-domain>`,
alongside a companion `<qkit-domain>` placeholder (lines 30-45). No tracked
note referenced this until now. Decided 2026-07-17
(`Merqo Business/docs/business/2026-07-17-merqo-roadmap.md`): one domain,
kit subdomains (e.g. `merqo.net` + `qkit.merqo.net` etc. — see that doc for
the live TLD decision, which superseded an earlier `.sg`-only plan). Once
purchased, fill both placeholders and re-run the affected DEPLOY.md steps.

## P2 — real money, not urgent pre-launch

### T2. No admin pricing panel / no `pricing_config` table

Genuinely undocumented anywhere before this — not even mentioned as a
non-goal in any spec, just absent. A `/admin/pricing` page (view/edit each
kit's Pro price, enable/disable a kit, price-change audit log) was part of
the original ecosystem design (`docs/business/archive/
2026-07-12-merqo-pricing-billing.md` — **archived**, built around the
abandoned "menukit" concept, don't copy its specifics, only the general
shape). Not needed while there's one pilot vendor (Manfred) and no real
Pro billing anyway (T3) — revisit once there's more than one paying vendor,
per the roadmap's stated sequencing.

### T3. No real billing / Stripe integration

This one _is_ documented, just not as a task — `2026-07-06-merqo-home-
landing-design.md` states "No pricing/checkout. No Stripe" as an explicit
non-goal, and `2026-07-10-merqo-kit-upgrade-request-design.md` notes
neither qkit nor loopkit's upgrade flow does anything beyond inserting a
manual-review row. Same sequencing as T2 — deliberately deferred until
there's real revenue to justify it, not a bug. When it does get built,
reuse **one** Stripe (or HitPay) integration for both this and paykit's
future card-payment rail (see paykit's own `docs/meta/2026-07-17-paykit-
task-registry.md`, T3) — don't build billing-Stripe and payments-Stripe as
two separate integrations.

## P3 — hygiene, no functional impact

### T4. Two unpaired early specs predate the plan-file convention

`docs/superpowers/specs/2026-07-06-merqo-home-landing-design.md` and
`2026-07-06-merqo-kit-stacker-design.md` have no matching `plans/` file —
every spec dated 07-08 onward has a paired plan, these two (07-06, the
earliest) don't. Both look implemented (landing page + kit-stacker exist
in the live app) — this is a documentation-convention gap, not missing
work. No action needed beyond noting it, unless a future
`docs/superpowers` audit wants full pairing for consistency.

## Cross-kit note

Unlike qkit/loopkit/paykit, merqo hub coordinates _other_ kits rather than
serving customers directly — its P1/P2 items above are almost entirely
gated on ecosystem-level decisions (domain purchase, when to start charging
vendors) rather than engineering readiness. The engineering is done; the
business decisions aren't.
