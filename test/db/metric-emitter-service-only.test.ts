import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
const sql = readFileSync(
  new URL(
    "../../supabase/migrations/0031_metric_emitter_service_only.sql",
    import.meta.url,
  ),
  "utf8",
);
it("revokes inherited public execution and explicit client grants", () => {
  expect(sql).toMatch(
    /revoke execute on function merqo\.emit_metric\(uuid, text, text, jsonb\)\s+from public, anon, authenticated;/,
  );
  expect(sql).toMatch(
    /grant execute on function merqo\.emit_metric\(uuid, text, text, jsonb\)\s+to service_role;/,
  );
});
