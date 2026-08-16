import { NextResponse } from "next/server";
import { z } from "zod";
import { customerNotifySecretOk } from "@/lib/customer-notify-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const revalidate = 0;

// notify_ref (qkit's "waiting" flow — a connect-token round already
// minted this exact ref) and phone (loopkit's reuse-only flow — no
// connect-token round ever happened for this event) are mutually
// exclusive lookup modes: exactly one must be present, never both, never
// neither.
const bodySchema = z
  .object({
    vendor_id: z.string().uuid(),
    message: z.string().min(1),
    notify_ref: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
  })
  .refine(
    (data) => (data.notify_ref !== undefined) !== (data.phone !== undefined),
    { message: "Exactly one of notify_ref or phone is required" },
  );

/**
 * A kit calls this once its own event (order ready, reward redeemed)
 * happens. Resolves the linked Telegram chat via one of two lookup modes
 * and sends, no-op (still 200) if no customer connection matches — the
 * calling kit's own event must never fail because a customer never
 * connected. Gated by `customerNotifySecretOk`.
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
  const { vendor_id, message, notify_ref, phone } = parsed.data;

  const supabase = await createServiceClient();

  let chatId: number | null = null;
  if (notify_ref !== undefined) {
    // Single-use: the RPC clears pending_notify_ref in the same statement
    // it reads it, so a repeat call with the same ref (or a genuine race)
    // finds no match on the second call.
    const { data, error } = await supabase.rpc("claim_customer_by_notify_ref", {
      p_vendor_id: vendor_id,
      p_notify_ref: notify_ref,
    });
    if (error) {
      console.error(
        "notify-customer: claim_customer_by_notify_ref failed",
        error.message,
      );
      return NextResponse.json({ ok: true, sent: false });
    }
    chatId = data;
  } else {
    // phone is guaranteed defined here — bodySchema's refine enforces
    // exactly one of notify_ref/phone.
    const { data, error } = await supabase.rpc(
      "find_customer_telegram_by_phone",
      { p_vendor_id: vendor_id, p_phone: phone },
    );
    if (error) {
      console.error(
        "notify-customer: find_customer_telegram_by_phone failed",
        error.message,
      );
      return NextResponse.json({ ok: true, sent: false });
    }
    chatId = data;
  }

  if (chatId === null) {
    return NextResponse.json({ ok: true, sent: false });
  }

  await sendTelegramMessage(chatId, message);
  return NextResponse.json({ ok: true, sent: true });
}
