import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0011_vendor_feedback.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0011_vendor_feedback migration", () => {
  it("creates vendor_feedback with a NOT NULL kit_slug referencing merqo.products", () => {
    expect(sql).toContain("create table merqo.vendor_feedback");
    expect(sql).toMatch(
      /kit_slug\s+text\s+not null\s+references merqo\.products\(slug\)/,
    );
  });

  it("checks nps is between 0 and 10", () => {
    expect(sql).toMatch(
      /nps\s+int\s+not null\s+check \(nps between 0 and 10\)/,
    );
  });

  it("enables RLS with a team-select policy and no insert policy", () => {
    expect(sql).toContain(
      "alter table merqo.vendor_feedback enable row level security",
    );
    expect(sql).toMatch(
      /create policy vendor_feedback_team_select on merqo\.vendor_feedback\s*\n\s*for select using \(merqo\.is_merqo_team\(auth\.uid\(\)\)\)/,
    );
    expect(sql).not.toMatch(/for insert/);
  });

  it("defines submit_vendor_feedback as security definer with a pinned search_path", () => {
    expect(sql).toMatch(
      /create (or replace )?function merqo\.submit_vendor_feedback/,
    );
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/set search_path\s*=\s*''/);
  });

  it("submit_vendor_feedback rejects an unauthenticated caller before writing", () => {
    const idx = sql.indexOf(
      "create or replace function merqo.submit_vendor_feedback",
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const body = sql.slice(idx);
    expect(body).toMatch(/if auth\.uid\(\) is null then/);
    expect(body).toMatch(/raise exception/);
    expect(body.indexOf("auth.uid() is null")).toBeLessThan(
      body.indexOf("insert into merqo.vendor_feedback"),
    );
  });

  it("submit_vendor_feedback writes auth.uid() as vendor_id, never a passed-in id", () => {
    const idx = sql.indexOf(
      "create or replace function merqo.submit_vendor_feedback",
    );
    const body = sql.slice(idx);
    expect(body).toMatch(
      /insert into merqo\.vendor_feedback \(kit_slug, vendor_id, nps, message\)/,
    );
    expect(body).toMatch(/values \(p_kit_slug, auth\.uid\(\)/);
  });

  it("grants execute to authenticated, not anon", () => {
    expect(sql).toMatch(
      /grant execute on function merqo\.submit_vendor_feedback[^;]*to[^;]*authenticated/,
    );
    expect(sql).not.toMatch(/grant execute[^;]*to[^;]*anon/);
  });
});
