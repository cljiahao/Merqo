import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL("../../supabase/migrations/0008_kit_events.sql", import.meta.url),
  ),
  "utf8",
).toLowerCase();

describe("0008_kit_events migration", () => {
  it("creates merqo.kit_events with the required columns", () => {
    expect(sql).toContain("create table merqo.kit_events");
    expect(sql).toMatch(/vendor_id\s+uuid\s+not null/);
    expect(sql).toMatch(/kit_name\s+text\s+not null/);
    expect(sql).toMatch(/event_type\s+text\s+not null/);
    expect(sql).toMatch(/event_data\s+jsonb\s+not null\s+default\s+'\{\}'/);
  });
  it("indexes vendor_id and event_type", () => {
    expect(sql).toMatch(/create index[^;]*kit_events\s*\(\s*vendor_id/);
    expect(sql).toMatch(/create index[^;]*kit_events\s*\(\s*event_type\s*\)/);
  });
  it("defines emit_metric as security definer with a pinned search_path", () => {
    expect(sql).toMatch(/create (or replace )?function merqo\.emit_metric/);
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/set search_path\s*=\s*''/);
  });
  it("grants execute to authenticated and service_role, not anon", () => {
    expect(sql).toMatch(
      /grant execute on function merqo\.emit_metric[^;]*to[^;]*authenticated/,
    );
    expect(sql).not.toMatch(
      /grant execute on function merqo\.emit_metric[^;]*to[^;]*anon/,
    );
  });
});
