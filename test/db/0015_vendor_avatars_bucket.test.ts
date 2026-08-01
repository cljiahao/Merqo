import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const sql = readFileSync(
  fileURLToPath(
    new URL(
      "../../supabase/migrations/0015_vendor_avatars_bucket.sql",
      import.meta.url,
    ),
  ),
  "utf8",
).toLowerCase();

describe("0015_vendor_avatars_bucket migration", () => {
  it("creates a public vendor-avatars bucket", () => {
    expect(sql).toContain("insert into storage.buckets");
    expect(sql).toContain("'vendor-avatars', 'vendor-avatars', true");
  });

  it("allows public read of avatar objects", () => {
    expect(sql).toContain("vendor_avatars_public_read");
    expect(sql).toContain("for select");
  });

  it("scopes vendor write policies to their own auth.uid() folder", () => {
    for (const policy of [
      "vendor_avatars_owner_insert",
      "vendor_avatars_owner_update",
      "vendor_avatars_owner_delete",
    ]) {
      expect(sql).toContain(policy);
    }
    expect(sql).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });
});
