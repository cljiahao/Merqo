import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0010_cross_kit_support_messages.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0010_cross_kit_support_messages migration", () => {
  it("adds a nullable kit_slug column to support_messages", () => {
    expect(sql).toContain("alter table merqo.support_messages");
    expect(sql).toMatch(/add column kit_slug text/);
    // must not be declared not null — null means "about Merqo hub itself"
    expect(sql).not.toMatch(/add column kit_slug text not null/);
  });

  it("drops the old fixed-enum category check and replaces it with a shape-only check", () => {
    expect(sql).toContain("drop constraint support_messages_category_check");
    expect(sql).toMatch(
      /add constraint support_messages_category_shape\s*\n?\s*check \(char_length\(category\) between 1 and 40\)/,
    );
    // the old fixed vocabulary must not survive anywhere in this migration
    expect(sql).not.toMatch(/vendor_access[\s\S]*billing[\s\S]*team/);
  });

  it("defines submit_support_message as security definer with a pinned search_path", () => {
    expect(sql).toMatch(
      /create (or replace )?function merqo\.submit_support_message/,
    );
    expect(sql).toContain("security definer");
    expect(sql).toMatch(/set search_path\s*=\s*''/);
  });

  it("submit_support_message rejects an unauthenticated caller before writing", () => {
    const idx = sql.indexOf(
      "create or replace function merqo.submit_support_message",
    );
    expect(idx).toBeGreaterThanOrEqual(0);
    const body = sql.slice(idx);
    expect(body).toMatch(/if auth\.uid\(\) is null then/);
    expect(body).toMatch(/raise exception/);
    expect(body.indexOf("auth.uid() is null")).toBeLessThan(
      body.indexOf("insert into merqo.support_messages"),
    );
  });

  it("submit_support_message writes auth.uid() as user_id, never a passed-in id", () => {
    const idx = sql.indexOf(
      "create or replace function merqo.submit_support_message",
    );
    const body = sql.slice(idx);
    expect(body).toMatch(
      /insert into merqo\.support_messages \(user_id, kit_slug, category, body\)/,
    );
    expect(body).toMatch(/values \(auth\.uid\(\)/);
  });

  it("grants execute to authenticated, not anon", () => {
    expect(sql).toMatch(
      /grant execute on function merqo\.submit_support_message[^;]*to[^;]*authenticated/,
    );
    expect(sql).not.toMatch(/grant execute[^;]*to[^;]*anon/);
  });
});
