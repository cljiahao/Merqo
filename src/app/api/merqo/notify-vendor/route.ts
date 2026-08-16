import { NextResponse } from "next/server";
import { z } from "zod";
import { customerNotifySecretOk } from "@/lib/customer-notify-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const revalidate = 0;

const bodySchema = z.object({
  vendor_id: z.string().uuid(),
  message: z.string().min(1),
});

/**
 * A kit calls this once its own vendor-facing event happens (order placed
 * for qkit, reward redeemed for loopkit) to fire a Telegram notification
 * to that vendor — the Phase A2 replacement for each kit's own per-kit
 * vendor-alert bot. Simpler than `notify-customer`: one lookup key
 * (`vendor_id`), no dual mode, nothing to clear (a vendor's link is a
 * standing connection, not a single-use ref). Never throws to its caller
 * in a way that could look like a hard failure to retry — a missing link
 * or a lookup error is a silent `{ ok: true, sent: false }`, same rule as
 * `notify-customer`.
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
  const { vendor_id, message } = parsed.data;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("vendor_telegram")
    .select("chat_id")
    .eq("vendor_id", vendor_id)
    .maybeSingle();

  if (error) {
    console.error(
      "notify-vendor: vendor_telegram lookup failed",
      error.message,
    );
    return NextResponse.json({ ok: true, sent: false });
  }
  if (!data) {
    return NextResponse.json({ ok: true, sent: false });
  }

  await sendTelegramMessage(data.chat_id, message);
  return NextResponse.json({ ok: true, sent: true });
}
