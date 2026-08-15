import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import sonarjs from "eslint-plugin-sonarjs";

// One shared plugin reference: mixing sonarjs.configs.recommended with a
// separate `plugins: { sonarjs }` block in another config object throws
// "Cannot redefine plugin sonarjs" — every block below reuses this instead.
const sonarjsPlugin = sonarjs.configs.recommended.plugins.sonarjs;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    ...sonarjs.configs.recommended,
    rules: {
      ...sonarjs.configs.recommended.rules,
      // Comment hygiene (templateCentral standard, hard gate as of 5.8, parity
      // with every sibling kit as of 5.13): own-line comments only, no
      // commented-out code. See templatecentral:standards code-standards/comments.md.
      "no-inline-comments": [
        "error",
        {
          ignorePattern:
            "eslint-|@ts-|prettier-|c8 |istanbul |webpackChunkName",
        },
      ],
      // recommended leaves this off; templateCentral's comment-hygiene gate requires it.
      "sonarjs/no-commented-code": "error",
    },
  },
  {
    // shadcn/ui primitives are generated, not hand-edited — prefer-read-only-props
    // fires on their prop typing and can't be fixed without diverging from `shadcn add` output.
    files: ["src/components/ui/**/*.{ts,tsx}"],
    plugins: { sonarjs: sonarjsPlugin },
    rules: { "sonarjs/prefer-read-only-props": "off" },
  },
  {
    // Tests routinely label table-driven cases and fixtures with short
    // trailing notes; that reads better inline, so the gate would be pure
    // noise there. Test fixtures also legitimately use fake secrets and
    // http:// literals to exercise guards.
    files: ["**/*.test.{ts,tsx}", "**/test/**", "e2e/**"],
    plugins: { sonarjs: sonarjsPlugin },
    rules: {
      "no-inline-comments": "off",
      "sonarjs/no-hardcoded-secrets": "off",
      "sonarjs/no-clear-text-protocols": "off",
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
