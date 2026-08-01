import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // templateCentral 5.8 comment hygiene — non-blocking nudge for tenet 2
      // (prefer own-line comments; trailing comments sparingly).
      "no-inline-comments": "warn",
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
