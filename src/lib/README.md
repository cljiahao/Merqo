# lib

## Purpose

Shared server/client logic: Supabase clients, domain types, Zod schemas, and
the pure functions the app router pages/components call into — everything
that isn't a route or a component.

## Contents

- `account.ts` — reads `display_name`/`avatar_url` defensively off the auth user's untyped `user_metadata`.
- `action-result.ts` — `ActionResult<T>`, the discriminated success/error return type every Server Action uses.
- `billing-settings.ts` — `getBillingSettings()`: reads the singleton `merqo.billing_settings` row (currently just `bundle_discount_enabled`), falling back to `DEFAULT_BILLING_SETTINGS` (`false`) if the row can't be read. Backs the admin overview page's bundle-discount toggle; no kit consumes this flag yet.
- `billing-settings.test.ts` — mocked `createServiceClient` coverage: returns the live row's value, falls back to the default on a read error, and falls back when no row exists.
- `admin.ts` — Merqo-team admin gate (`requireTeamMember`-style helpers) and vendor-grant status queries used by `/admin`.
- `brand-icon.tsx` — Merqo's mark as concrete hex constants, for `ImageResponse`-based icon routes (`icon.tsx`/`apple-icon.tsx`); tracks the "Harbour Control" theme (as of 2026-08-19).
- `customer-notify-auth.ts` — `customerNotifySecretOk(request)`: constant-time check of `Authorization: Bearer <MERQO_CUSTOMER_SECRET>`, mirroring qkit's own `provisionBearerOk` shape — the first time merqo is the RECEIVING side of a bearer-authenticated call. Gates the two `/api/merqo/*` customer-notify routes.
- `customer-notify-auth.test.ts` — valid/missing/wrong-prefix/wrong-secret/wrong-length bearer cases, plus fails-closed when `MERQO_CUSTOMER_SECRET` is unset.
- `downgrade-request.ts` — posts a vendor's Pro→Free downgrade request to a kit's metrics API.
- `ecosystem.ts` — data for the landing "kit stacker" graph (node positions, edges); `status` per node is derived from `kits.ts` (the source of truth) at module load, not hand-duplicated, so the two can't drift out of sync.
- `feedback-support-schemas.ts` — Zod schemas for the vendor feedback (NPS) and support-message forms.
- `format.ts` — `money()`, relative-time, and other small display formatters shared across dashboard/team pages.
- `funnel.ts` — onboarding funnel counts (waitlisted/needs-setup/granted) for the admin overview.
- `health.ts` — classifies a kit's metrics-call latency into `reporting`/`lagging`/`down`.
- `image-resize.ts` — client-side (Canvas) image downscale + WebP encode before an avatar upload.
- `image-upload-adapter.ts` — `uploadVendorAvatar`, the `onUpload` backend @merqo/ui's `ImageUploader` is injected with: writes the already-resized blob to Supabase Storage and resolves its public URL. Keeps `ImageUploader` itself storage-backend-agnostic.
- `kit-action-request.ts` — shared HTTP helpers for calling a kit's merqo-integration API: `fetchKitJson()` (timeout + JSON parse + Zod-validate, used by `metrics-client.ts`/`vendor-metrics-client.ts`/`vendor-sync.ts`) and `postKitAction()` (POST an email-keyed action, used by `upgrade-request.ts`/`downgrade-request.ts`).
- `kits.ts` — the kit family config (status/tagline/description/href per kit) — the landing roadmap and dashboard discovery cards' source of truth.
- `merqo-vendor-profile.ts` — typed wrapper over `merqo.get_or_create_vendor_profile`/`upsert_vendor_profile`.
- `metrics-client.ts` / `metrics-schema.ts` — fetch + Zod-validate a kit's platform-wide metrics payload (admin overview).
- `nps.ts` — Net Promoter Score bucketing/scoring, ported from qkit's own `nps.ts`.
- `overview.ts` — aggregates per-kit metrics into the admin overview's platform totals.
- `products.ts` — the kit registry (`RegistryRow`) read/cache from `merqo.products`, including each kit's `metrics_secret`.
- `qr.ts` — `qrSvg(text)`: renders `text` (a Telegram deep link) as an inline SVG markup string via the `qrcode` package, for `@merqo/ui`'s `VendorTelegramSection` to render via `dangerouslySetInnerHTML`. Same shape/library as loopkit's and qkit's own (now-retired, Phase A2) per-kit `qrSvg` helpers.
- `qr.test.ts` — asserts the rendered string is real SVG markup.
- `schemas.ts` — Zod schemas for the shared `merqo.vendor_profile` social/website links.
- `support.ts` — reads open cross-kit support messages for the admin console.
- `team.ts` — gates an operator page on Merqo-team membership, redirecting a non-member.
- `telegram.ts` — `sendTelegramMessage(chatId, text)` (fire-and-forget POST to the Bot API's `sendMessage`, no-ops without `TELEGRAM_BOT_TOKEN`, catches+logs a fetch failure rather than throwing) and `generateLinkToken()` (a `[A-Za-z0-9_-]{1,64}`-safe token for the `t.me/<bot>?start=<token>` deep link — Telegram's own payload constraint). Same shape as every kit's own Phase A copy, deliberately not shared as a package.
- `telegram.test.ts` — the send/no-op/catch/token-shape assertions above.
- `tour-prefs.ts` — `stampTourSeen(supabase, userId)`: upserts `dashboard_prefs.tour_seen_at = now()`. A plain (non-`"use server"`) module so `src/app/dashboard/(app)/layout.tsx` can call it directly during its own server render — the durable half of the onboarding-tour "stamp on start" fix, since the client-fired path (`src/app/dashboard/tour-actions.ts`'s `markTourSeen`, which also delegates here) is fire-and-forget and can be aborted by a hard navigation before it lands.
- `types.ts` — hand-maintained DB types mirroring `supabase/migrations` (`SocialLinks`, etc.).
- `upgrade-request.ts` — posts a vendor's Free→Pro upgrade request to a kit's metrics API.
- `utils.ts` — `cn()` (clsx + tailwind-merge), shared across every component.
- `vendor-feedback.ts` — reads cross-kit `merqo.vendor_feedback` (NPS) rows for the admin feedback page.
- `vendor-grants.ts` — pure `GrantStatus` (`active`/`waitlist`/`needs_setup`) helpers; client-safe (no `supabase/server` import) since `vendor-list.tsx` imports it directly.
- `vendor-metrics-client.ts` / `vendor-metrics-schema.ts` — fetch + Zod-validate a single vendor's per-kit stats for the vendor dashboard.
- `vendor-sync.ts` — provisions/syncs a vendor's `vendor_links` rows against the live kit registry.
- `vendor.ts` — gates the vendor dashboard on an authenticated session with at least one kit grant.
- `waitlist.ts` — adds an email to a kit's waitlist, from either the public landing form or the signed-in dashboard.
- `savings.ts` / `savings.test.ts` — the "hours/cost saved" estimate shown on the vendor dashboard.
- `vendor-feedback.test.ts`, `vendor-sync.test.ts`, `vendor.test.ts` — co-located unit tests for the same-named modules above.
- `supabase/` — browser / server (schema=merqo) / service-role Supabase clients + the session-refresh middleware helper.

## Parent

See the repo root [README.md](../../README.md) for the full `src/` layout.
