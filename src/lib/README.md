# lib

Shared domain logic, validated HTTP boundaries, database adapters and display
helpers. Session clients enforce vendor RLS; service clients are server-only and
require the caller to establish the relevant authorization first.

## Authorization and persistence

`team.ts` and `admin.ts` establish team access and support the operator console.
`vendor.ts` establishes signed-in vendor context and current legal acceptance.
`merqo-vendor-profile.ts` reads/provisions the shared profile and applies
owner-scoped field patches. `schemas.ts` validates profile input, including
HTTP(S)-only social links. `feedback-support-schemas.ts` validates dialog input.
`types.ts` mirrors the migration contracts; `action-result.ts` defines
serializable action results.

`billing-settings.ts`, `products.ts`, `support.ts` and `vendor-feedback.ts`
read console data. Registry secrets remain server-side. `admin.ts` owns the
best-effort audit writer and recent-entry read; an audit failure is not proof
that the primary mutation failed.

## Cross-kit calls

`kit-action-request.ts` centralizes timeout, parse and Zod validation for peer
HTTP calls. Metrics and vendor metrics/activities have separate response schemas
and clients. `upgrade-request.ts` and `downgrade-request.ts` request plan changes;
`vendor-sync.ts` refreshes grants against the live registry with an email-scoped
throttle. `vendor-grants.ts` provides client-safe grant-state helpers.

`customer-notify-auth.ts` verifies the shared bearer secret for inbound Telegram
and legal endpoints. It authenticates a participating server, not an end user.
`telegram.ts` generates link tokens and sends notifications best-effort without
logging credentials. Customer consent and token consumption are database/RPC
contracts; mocked network tests do not establish those database guarantees.

## Pure logic and presentation

`health.ts`, `overview.ts`, `funnel.ts`, `nps.ts` and `savings.ts` derive
console and dashboard figures. Funnel counts are distinct populations, so do not
report them as nested conversion stages. `kits.ts` is the family configuration;
`ecosystem.ts` derives its diagram status from that configuration.
`format.ts` and `utils.ts` provide display formatting and class composition.
`brand-icon.tsx` supplies icon-route markup; `account.ts` safely reads metadata.

`tour-prefs.ts` persists onboarding timestamps best-effort. Both server-render
and client-action call sites exist; failed writes/navigation can still prevent
persistence, and tour status is never authorization.

## Shared UI and Storage

Redirect validation and image resizing come from `@merqo/ui`; local
`safe-redirect.ts` and `image-resize.ts` copies have been removed.
`image-upload-adapter.ts` stays local because it owns bucket/object paths.
Cleanup accepts only supported public avatar buckets and never external OAuth
pictures; owner-folder Storage policies constrain deletion. An uncertain save
outcome is not proof that an uploaded object is unused.

See [supabase](supabase/README.md) for browser/session/service clients.
Co-located tests cover boundary errors and pure behavior; live RLS and cross-kit
integration are verified separately.

## Parent

[src](../README.md)
