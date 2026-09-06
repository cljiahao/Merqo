"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getLegalDocSource, LEGAL_VERSIONS } from "@merqo/ui";

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

function clientIp(hdrs: Headers): string {
  return (
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Records terms + privacy acceptance rows for the signed-in vendor and sends
 * them on to `next`. Each doc type is inserted independently: a duplicate
 * (vendor_email, doc_type, doc_version) unique-constraint violation (Postgres
 * 23505 — this exact version was already accepted, e.g. a double form submit,
 * or the vendor is already current on one doc but not the other since terms
 * and privacy versions bump independently) is tolerated per doc type, so a
 * conflict on one never blocks the other from being persisted.
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

  const legalName = String(formData.get("legal_name") || "").trim();
  if (!legalName) {
    throw new Error("legal_name is required");
  }

  const hdrs = await headers();
  const ip = clientIp(hdrs);
  const userAgent = hdrs.get("user-agent");

  const service = await createServiceClient();
  const email = user.email.toLowerCase();
  const docTypes = ["terms", "privacy"] as const;

  for (const docType of docTypes) {
    const { error } = await service.from("legal_acceptances").insert({
      vendor_email: email,
      auth_uid: user.id,
      doc_type: docType,
      doc_version: LEGAL_VERSIONS[docType],
      doc_sha256: sha256(getLegalDocSource(docType)),
      kit_slug: "merqo",
      legal_name: legalName,
      ip,
      user_agent: userAgent,
    });
    if (error && error.code !== "23505") {
      throw new Error(`legal acceptance insert failed: ${error.message}`);
    }
  }

  redirect(safeRedirectPath(String(formData.get("next") || ""), "/dashboard"));
}
