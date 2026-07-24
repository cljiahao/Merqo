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
    // .claude/harness.json, not style-checked here (mirrors lefthook.yml's
    // format-lint exclude for the same directory).
    ".claude/hooks/**",
  ]),
]);

export default eslintConfig;
