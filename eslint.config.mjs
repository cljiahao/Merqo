import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Comment hygiene (templateCentral standard, hard gate as of 5.8, parity
    // with every sibling kit as of 5.13): own-line comments only, no
    // commented-out code. See templatecentral:standards code-standards/comments.md.
    plugins: { sonarjs },
    rules: {
      "no-inline-comments": [
        "error",
        {
          ignorePattern:
            "eslint-|@ts-|prettier-|c8 |istanbul |webpackChunkName",
        },
      ],
      "sonarjs/no-commented-code": "error",
    },
  },
  {
    // Tests routinely label table-driven cases and fixtures with short
    // trailing notes; that reads better inline, so the gate would be pure
    // noise there.
    files: ["**/*.test.{ts,tsx}", "**/test/**", "e2e/**"],
    rules: {
      "no-inline-comments": "off",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Enforcement-layer scripts, not app code — integrity is hash-checked via
    // .claude/harness.json, not style-checked here (mirrors .husky/pre-commit's
    // format-lint exclude for the same directory).
    ".claude/hooks/**",
    // Agent worktrees are independent checkouts (their own node_modules,
    // .next, etc.) — not app code, and .gitignore's mismatch (see that file)
    // meant they were never actually excluded before.
    ".claude/worktrees/**",
    ".worktrees/**",
  ]),
]);

export default eslintConfig;
