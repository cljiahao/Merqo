import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0016_merqo_dashboard_prefs.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0016_merqo_dashboard_prefs migration", () => {
  it("creates merqo.dashboard_prefs with the required columns", () => {
    expect(sql).toContain("create table merqo.dashboard_prefs");
    expect(sql).toMatch(
      /user_id\s+uuid\s+primary key\s+references\s+auth\.users\(id\)/,
    );
    expect(sql).toMatch(/tour_seen_at\s+timestamptz/);
  });

  it("enables RLS on dashboard_prefs", () => {
    expect(sql).toMatch(
      /alter table merqo\.dashboard_prefs enable row level security/,
    );
  });

  it("defines owner-only select/insert/update policies, no team-sees-all override", () => {
    expect(sql).toMatch(
      /create policy dashboard_prefs_owner_select on merqo\.dashboard_prefs\s*\n\s*for select using \(user_id = \(select auth\.uid\(\)\)\)/,
    );
    expect(sql).toMatch(
      /create policy dashboard_prefs_owner_insert on merqo\.dashboard_prefs\s*\n\s*for insert with check \(user_id = \(select auth\.uid\(\)\)\)/,
    );
    expect(sql).toMatch(
      /create policy dashboard_prefs_owner_update on merqo\.dashboard_prefs\s*\n\s*for update using \(user_id = \(select auth\.uid\(\)\)\)\s*\n\s*with check \(user_id = \(select auth\.uid\(\)\)\)/,
    );
    expect(sql).not.toContain("is_merqo_team");
  });

  it("grants select/insert/update to authenticated and everything to service_role, nothing to anon", () => {
    expect(sql).toMatch(
      /grant select, insert, update on merqo\.dashboard_prefs to authenticated/,
    );
    expect(sql).toMatch(/grant all on merqo\.dashboard_prefs to service_role/);
    expect(sql).not.toMatch(
      /grant[^;]*on merqo\.dashboard_prefs[^;]*to[^;]*anon/,
    );
  });
});
