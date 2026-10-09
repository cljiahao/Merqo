import { latestLegalVersions } from "@/lib/legal-versions";
import { NextResponse } from "next/server";
import { z } from "zod";
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

  const email = z
    .string()
    .trim()
    .email()
    .safeParse(new URL(request.url).searchParams.get("email"));
  if (!email.success) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  let status: LegalStatus;
  try {
    const supabase = await createServiceClient();
    const versions = await latestLegalVersions(supabase, email.data, [
      "terms",
      "privacy",
      "pilot",
    ]);
    status = {
      terms: versions.terms ?? null,
      privacy: versions.privacy ?? null,
      pilot: versions.pilot ?? null,
    };
  } catch (error) {
    console.error("legal-status: read failed", error);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }
  return NextResponse.json(status);
}
