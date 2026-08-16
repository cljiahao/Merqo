import { NextResponse } from "next/server";
import { z } from "zod";
import { customerNotifySecretOk } from "@/lib/customer-notify-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { generateLinkToken } from "@/lib/telegram";

export const revalidate = 0;

const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

// `notify_ref` is an opaque, kit-chosen string (e.g. "qkit:<order_id>") —
// merqo never interprets it, only stores and echoes it back on
// notify-customer's notify_ref lookup mode.
const bodySchema = z.object({
  vendor_id: z.string().uuid(),
  kit_slug: z.string().min(1),
  notify_ref: z.string().min(1),
});

/**
 * A kit (currently qkit) calls this to mint a short-lived Telegram
 * connect-link token for one customer-facing event, and renders the
 * returned `deep_link` as a QR/button. Gated by `customerNotifySecretOk` —
 * the first kit → merqo HTTP direction in this codebase (every existing
 * cross-kit call flows merqo → kit).
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
    console.error("customer-connect-token: TELEGRAM_BOT_USERNAME is unset");
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
    notify_ref: parsed.data.notify_ref,
    expires_at: new Date(Date.now() + LINK_TOKEN_TTL_MS).toISOString(),
  });
  if (error) {
    console.error("customer-connect-token: insert failed", error.message);
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
