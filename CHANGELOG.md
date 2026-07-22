# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Cross-kit support inbox.** `merqo.support_messages` now accepts messages
  from any kit (not just Merqo hub itself) via a new
  `merqo.submit_support_message` RPC — a nullable `kit_slug` records which
  product a message is about (`null` stays the existing "about Merqo hub"
  meaning). The admin page shows the raw category plus which kit a message
  came from. paykit is the first kit wired up as a consumer.
