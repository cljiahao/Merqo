# scripts

## Purpose

Founder-run maintenance scripts, invoked manually.

## Contents

- `check-legal-version-skew.mjs` compares the terms, privacy and pilot legal
  versions at each app's exact locked `@merqo/ui` Git commit. Different UI
  releases are allowed when their legal versions match. It uses the sibling
  `merqo-ui` checkout; fetch missing locked commits before running
  `pnpm check:legal-versions`. A missing commit or mismatched legal version
  exits with an error.

## Parent

[merqo](../README.md)
