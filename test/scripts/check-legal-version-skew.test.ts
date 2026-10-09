import { describe, expect, it } from "vitest";
import {
  lockedUiCommit,
  legalVersionsFromSource,
  assertLegalVersionsMatch,
} from "../../scripts/check-legal-version-skew.mjs";
const commit = "a".repeat(40);
const version = {
  terms: "2026-09-16",
  privacy: "2026-09-16",
  pilot: "2026-09-16",
};
describe("legal version rollout check", () => {
  it("reads an immutable UI commit from the lock importer rather than the release tag", () => {
    expect(
      lockedUiCommit(
        `importers:\n  .:\n    dependencies:\n      '@merqo/ui':\n        specifier: github:merqo-io/merqo-ui#v0.32.0\n        version: https://codeload.github.com/merqo-io/merqo-ui/tar.gz/${commit}(react@19)\n`,
      ),
    ).toBe(commit);
  });
  it.each([
    "",
    "      '@merqo/ui':\n        specifier: github:merqo-io/merqo-ui#v0.32.0\n        version: 0.32.0",
    "      '@merqo/ui':\n        specifier: github:other/package#main\n        version: https://example.test/mutable",
  ])("rejects missing or mutable lock references", (lock) => {
    expect(() => lockedUiCommit(lock)).toThrow();
  });
  it("extracts actual document versions without executing the pinned source", () => {
    expect(
      legalVersionsFromSource(
        'export const LEGAL_VERSIONS = {terms:"2026-09-16",privacy:"2026-09-16",pilot:"2026-09-16"} as const;',
      ),
    ).toEqual(version);
  });
  it("fails closed when a required legal document version is absent", () => {
    expect(() =>
      legalVersionsFromSource(
        'export const LEGAL_VERSIONS = {terms:"2026-09-16",privacy:"2026-09-16"};',
      ),
    ).toThrow("pilot");
  });
  it("allows different UI releases carrying identical legal versions", () => {
    expect(
      assertLegalVersionsMatch([
        { repo: "merqo", versions: version },
        { repo: "printkit", versions: { ...version } },
      ]),
    ).toEqual(version);
  });
  it.each(["terms", "privacy", "pilot"])(
    "rejects actual %s skew",
    (document) => {
      expect(() =>
        assertLegalVersionsMatch([
          { repo: "merqo", versions: version },
          {
            repo: "printkit",
            versions: { ...version, [document]: "2026-09-15" },
          },
        ]),
      ).toThrow(document);
    },
  );
  it("does not treat empty scope as a passing check", () => {
    expect(() => assertLegalVersionsMatch([])).toThrow();
  });
});
