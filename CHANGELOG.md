# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Team lookup past 1000 auth users.** `listTeamMembers`/`addTeamMemberByEmail`
  (`src/lib/admin.ts`) now paginate `auth.admin.listUsers` instead of reading
  page 1 only, so accounts and team-member emails beyond the first 1000 auth
  users are no longer silently missed.
- Added pgTAP RLS coverage for `kit_events`, `vendor_profile`, and
  `vendor_feedback` (previously untested policies).

### Added

- **Cross-kit vendor feedback/NPS.** `merqo.vendor_feedback` converges
  loopkit/stockkit/paykit's identical local NPS tables via a new
  `merqo.submit_vendor_feedback` RPC. The admin feedback page now shows a
  per-kit NPS breakdown alongside Merqo hub's own NPS, plus a combined
  vendor-comments list tagged with which kit each one came from.
- **Cross-kit support inbox.** `merqo.support_messages` now accepts messages
  from any kit (not just Merqo hub itself) via a new
  `merqo.submit_support_message` RPC — a nullable `kit_slug` records which
  product a message is about (`null` stays the existing "about Merqo hub"
  meaning). The admin page shows the raw category plus which kit a message
  came from. paykit is the first kit wired up as a consumer.
