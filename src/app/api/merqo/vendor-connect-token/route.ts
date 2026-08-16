import { NextResponse } from "next/server";
import { z } from "zod";
import { customerNotifySecretOk } from "@/lib/customer-notify-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { generateLinkToken } from "@/lib/telegram";

export const revalidate = 0;

const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

const bodySchema = z.object({
  vendor_id: z.string().uuid(),
  kit_slug: z.string().min(1),
});

/**
 * A kit (qkit, loopkit) calls this once, from the vendor's own
 * profile/settings page, to mint a standing Telegram connect-link token —
 * the Phase A2 replacement for each kit's own now-retired vendor-alert
 * bot. Gated by `customerNotifySecretOk`, same trust boundary as the
 * customer-facing endpoints. Unlike `customer-connect-token`, there's no
 * `notify_ref` — a vendor's link is a standing connection, not scoped to
 * one order/event.
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

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    console.error("vendor-connect-token: TELEGRAM_BOT_USERNAME is unset");
    return NextResponse.json(
      { error: "Telegram isn't set up yet" },
      { status: 500 },
    );
  }

  const token = generateLinkToken();
  const supabase = await createServiceClient();
  const { error } = await supabase.from("telegram_link_tokens").insert({
    token,
    vendor_id: parsed.data.vendor_id,
    kit_slug: parsed.data.kit_slug,
    kind: "vendor",
    expires_at: new Date(Date.now() + LINK_TOKEN_TTL_MS).toISOString(),
  });
  if (error) {
    console.error("vendor-connect-token: insert failed", error.message);
    return NextResponse.json(
      { error: "Could not create a connect token" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token,
    deep_link: `https://t.me/${botUsername}?start=${token}`,
  });
}
