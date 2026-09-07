import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0029_founder_telegram_alerts.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0029_founder_telegram_alerts migration", () => {
  it("enables pg_net and supabase_vault", () => {
    expect(sql).toContain("create extension if not exists pg_net");
    expect(sql).toContain("create extension if not exists supabase_vault");
  });

  it("reads the bot token and chat id from vault, never a literal secret", () => {
    expect(sql).toContain("vault.decrypted_secrets");
    expect(sql).toContain("'telegram_bot_token'");
    expect(sql).toContain("'merqo_founder_telegram_chat_id'");
    expect(sql).not.toMatch(/\d{6,12}:[a-z0-9_-]{30,40}/i);
  });

  it("no-ops instead of raising when a secret is unset", () => {
    expect(sql).toMatch(
      /if v_token is null or v_chat_id is null then\s+return;/,
    );
  });

  it("adds an AFTER INSERT trigger on all three feedback/support tables", () => {
    expect(sql).toContain("after insert on merqo.support_messages");
    expect(sql).toContain("after insert on merqo.vendor_feedback");
    expect(sql).toContain("after insert on merqo.feedback");
  });
});
