import { NextResponse } from "next/server";
import { z } from "zod";
import { customerNotifySecretOk } from "@/lib/customer-notify-auth";
import { createServiceClient } from "@/lib/supabase/server";

export const revalidate = 0;

const bodySchema = z.object({
  vendor_email: z.string().email(),
  auth_uid: z.string().uuid().nullable().optional(),
  doc_type: z.enum(["terms", "privacy", "pilot"]),
  doc_version: z.string().min(1),
  doc_sha256: z.string().length(64),
  kit_slug: z.string().min(1),
});

/**
 * A kit calls this, server-side, once its own gate confirms the signed-in
 * vendor just ticked the acceptance checkbox on its /legal/accept
 * interstitial. Idempotent: a duplicate (vendor_email, doc_type,
 * doc_version) is a unique-constraint violation (Postgres code 23505),
 * treated as success rather than an error.
 */
export async function POST(request: Request): Promise<Response> {
  if (!customerNotifySecretOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("legal_acceptances").insert({
    vendor_email: parsed.data.vendor_email.toLowerCase(),
    auth_uid: parsed.data.auth_uid ?? null,
    doc_type: parsed.data.doc_type,
    doc_version: parsed.data.doc_version,
    doc_sha256: parsed.data.doc_sha256,
    kit_slug: parsed.data.kit_slug,
    ip: request.headers.get("x-forwarded-for"),
    user_agent: request.headers.get("user-agent"),
  });

  if (error && error.code !== "23505") {
    console.error("legal-accept: insert failed", error.message);
    return NextResponse.json(
      { ok: false, error: "insert failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
