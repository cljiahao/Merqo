import { NextResponse } from "next/server";
import { customerNotifySecretOk } from "@/lib/customer-notify-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const revalidate = 0;

type LegalStatus = {
  terms: string | null;
  privacy: string | null;
  pilot: string | null;
};

/**
 * A kit calls this to decide whether its acceptance gate should fire —
 * "what's the latest version of each doc this email has accepted?" Not
 * cached here; the calling kit is responsible for its own short-TTL cache
 * (mirrors the vendor_sync_state pattern) so this isn't hit on every
 * request.
 */
export async function GET(request: Request): Promise<Response> {
  if (!customerNotifySecretOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = new URL(request.url).searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("doc_type, doc_version")
    .eq("vendor_email", email.toLowerCase())
    .order("doc_version", { ascending: false });

  if (error) {
    console.error("legal-status: read failed", error.message);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  const status: LegalStatus = { terms: null, privacy: null, pilot: null };
  for (const row of data ?? []) {
    const docType = row.doc_type as keyof LegalStatus;
    if (!status[docType]) status[docType] = row.doc_version as string;
  }
  return NextResponse.json(status);
}
