import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0007_feedback_and_support.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0007_feedback_and_support migration", () => {
  it("creates support_messages with an open/resolved status check", () => {
    expect(sql).toContain("create table merqo.support_messages");
    expect(sql).toContain("check (status in ('open', 'resolved')");
  });

  it("creates feedback with an nps range check", () => {
    expect(sql).toContain("create table merqo.feedback");
    expect(sql).toContain("check (nps between 0 and 10)");
  });

  it("enables RLS and grants the authenticated role on both tables", () => {
    expect(sql).toContain(
      "alter table merqo.support_messages enable row level security",
    );
    expect(sql).toContain(
      "alter table merqo.feedback enable row level security",
    );
    expect(sql).toContain(
      "grant select, insert, update on merqo.support_messages to authenticated",
    );
    expect(sql).toContain(
      "grant select, insert on merqo.feedback to authenticated",
    );
  });
});
