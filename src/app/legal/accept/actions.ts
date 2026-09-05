"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { getLegalDocSource, LEGAL_VERSIONS } from "@merqo/ui";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Records both terms + privacy acceptance rows for the signed-in vendor and
 * sends them on to `next`. Idempotent: a duplicate (vendor_email, doc_type,
 * doc_version) unique-constraint violation (Postgres 23505 — the vendor
 * already accepted this exact version, e.g. a double form submit) is treated
 * as success, matching /api/merqo/legal-accept's same tolerance.
 */
export async function acceptLegalTerms(formData: FormData): Promise<void> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    redirect("/login");
    return;
  }

  const service = await createServiceClient();
  const rows = [
    {
      vendor_email: user.email.toLowerCase(),
      auth_uid: user.id,
      doc_type: "terms" as const,
      doc_version: LEGAL_VERSIONS.terms,
      doc_sha256: sha256(getLegalDocSource("terms")),
      kit_slug: "merqo",
    },
    {
      vendor_email: user.email.toLowerCase(),
      auth_uid: user.id,
      doc_type: "privacy" as const,
      doc_version: LEGAL_VERSIONS.privacy,
      doc_sha256: sha256(getLegalDocSource("privacy")),
      kit_slug: "merqo",
    },
  ];
  const { error } = await service.from("legal_acceptances").insert(rows);
  if (error && error.code !== "23505") {
    throw new Error(`legal acceptance insert failed: ${error.message}`);
  }
  redirect(String(formData.get("next") || "/dashboard"));
}
