import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  envDir: false,
  test: {
    maxWorkers: 2,
    environment: "node",
    globals: true,
    testTimeout: 30000,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.{test,spec}.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      thresholds: { statements: 80, branches: 80, functions: 80, lines: 80 },
      reporter: ["text", "lcov", "cobertura"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
