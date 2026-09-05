import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const revalidate = 0;

const START_PREFIX = "/start ";

/**
 * The leading command word of a message, normalised — `/privacy@merqobot arg`
 * and `  /PRIVACY ` both resolve to `/privacy`. Returns undefined for a
 * non-command message.
 */
function commandOf(text: string | undefined): string | undefined {
  const first = text?.trim().split(/\s+/, 1)[0]?.toLowerCase();
  if (!first?.startsWith("/")) return undefined;
  return first.split("@", 1)[0];
}

/**
 * `/privacy` reply: links to the end-customer notice + Privacy Policy. The
 * notice is a plain-language disclosure, not a contract — there's no ToS
 * binding an end-customer. See
 * docs/superpowers/specs/2026-09-04-merqo-legal-docs-design.md.
 */
function privacyReply(origin: string): string {
  return [
    "Merqo sends you order and reward updates on behalf of the shop you bought from.",
    "",
    `How your information is used: ${origin}/legal/end-customer-notice`,
    `Full Privacy Policy: ${origin}/legal/privacy`,
    "",
    "Reply /stop to stop these messages.",
  ].join("\n");
}

/**
 * `/stop`: clears `consent_given_at` for the `merqo.customers` row(s) linked
 * to this Telegram chat, so the cross-kit notify path stops messaging them.
 * Keyed on the incoming `chat_id` alone — no vendor scope, because one chat
 * can be linked under several vendors and `/stop` opts out of all of them.
 * The customers table has no direct write grant (0018/0019), so this goes
 * through a SECURITY DEFINER RPC. A `/stop` from a chat that was never
 * connected clears nothing and still gets the same confirmation.
 */
async function handleStop(chatId: number): Promise<void> {
  const supabase = await createServiceClient();
  const { error } = await supabase.rpc("clear_customer_consent_by_telegram", {
    p_telegram_chat_id: chatId,
  });
  if (error) {
    console.error(
      "telegram webhook: clear_customer_consent_by_telegram failed",
      error.message,
    );
  }
  await sendTelegramMessage(
    chatId,
    "You're unsubscribed. This bot will no longer send you order or reward updates. " +
      "The shop you bought from still has your order details — contact them directly for anything about your order.",
  );
}

/**
 * Constant-time check of Telegram's `X-Telegram-Bot-Api-Secret-Token`
 * header against `TELEGRAM_WEBHOOK_SECRET` (configured on this bot's
 * `setWebhook` call — see docs/DEPLOY.md's deploy notes). Mandatory, not
 * optional: without it, anyone who discovers this URL could POST fake
 * Updates and link arbitrary chats to a vendor's customer. Fails closed
 * when the secret isn't configured at all. This is merqo's OWN third bot
 * — distinct from qkit's/loopkit's own Phase A vendor-alert bots — so this
 * secret is never shared with either of them.
 */
function secretOk(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const provided = Buffer.from(header);
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length && timingSafeEqual(provided, expected)
  );
}

// Only the shape this route actually reads out of a Telegram Update —
// everything else Telegram sends (edited_message, callback_query, etc.) is
// simply ignored, not validated.
const updateSchema = z.object({
  message: z
    .object({
      text: z.string().optional(),
      chat: z.object({ id: z.number() }),
    })
    .optional(),
});

/**
 * Resolves a `/start <token>` deep link: looks up the token (service-role —
 * merqo.telegram_link_tokens has no client-read policy at all), rejects
 * silently if missing/expired, otherwise links the chat and burns the
 * token. Branches on the token's `kind` (0020): `'customer'` links via the
 * merqo.upsert_customer_telegram RPC, a distinct insert path from the
 * phone-keyed merqo.upsert_customer RPC — a customer connecting this way
 * has no phone yet, so the row is keyed purely on (vendor_id,
 * telegram_chat_id). `'vendor'` links via a plain upsert on
 * merqo.vendor_telegram — that table grants service_role a direct table
 * write (no RPC indirection needed, unlike customers which has zero
 * grants to anyone) and is keyed on its own `vendor_id` primary key. Any
 * failure here is caught by the caller and logged, never surfaced to
 * Telegram as a non-200.
 */
async function handleStart(token: string, chatId: number): Promise<void> {
  const supabase = await createServiceClient();

  const { data: linkToken } = await supabase
    .from("telegram_link_tokens")
    .select("vendor_id, notify_ref, expires_at, kind")
    .eq("token", token)
    .maybeSingle();

  if (!linkToken) return;
  if (new Date(linkToken.expires_at).getTime() < Date.now()) return;

  if (linkToken.kind === "vendor") {
    const { error: upsertError } = await supabase
      .from("vendor_telegram")
      .upsert(
        { vendor_id: linkToken.vendor_id, chat_id: chatId },
        { onConflict: "vendor_id" },
      );
    if (upsertError) {
      console.error(
        "telegram webhook: vendor_telegram upsert failed",
        upsertError.message,
      );
      return;
    }
  } else {
    const { error: rpcError } = await supabase.rpc("upsert_customer_telegram", {
      p_vendor_id: linkToken.vendor_id,
      p_telegram_chat_id: chatId,
      p_notify_ref: linkToken.notify_ref,
    });
    if (rpcError) {
      console.error(
        "telegram webhook: upsert_customer_telegram failed",
        rpcError.message,
      );
      return;
    }
  }

  // Single-use — burn the token whether or not the confirmation send below
  // succeeds (the account is already linked at this point).
  await supabase.from("telegram_link_tokens").delete().eq("token", token);
  await sendTelegramMessage(
    chatId,
    linkToken.kind === "vendor"
      ? "Your Telegram is connected! We'll alert you here about new activity for your shop."
      : "You're connected! We'll notify you here about your order/reward activity.",
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!secretOk(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    // Not a real Telegram payload — nothing to do, but still ack so nothing
    // upstream retries a body that will never parse.
    return NextResponse.json({ ok: true });
  }

  const parsed = updateSchema.safeParse(json);
  const message = parsed.success ? parsed.data.message : undefined;

  if (message?.text?.startsWith(START_PREFIX)) {
    const token = message.text.slice(START_PREFIX.length).trim();
    try {
      if (token) await handleStart(token, message.chat.id);
    } catch (err) {
      // Internal failure resolving/linking — log it, but Telegram retries
      // aggressively on any non-2xx, so this must never surface as one.
      console.error("telegram webhook: /start handling failed", err);
    }
  } else if (message) {
    const cmd = commandOf(message.text);
    try {
      if (cmd === "/privacy") {
        await sendTelegramMessage(
          message.chat.id,
          privacyReply(new URL(request.url).origin),
        );
      } else if (cmd === "/stop") {
        await handleStop(message.chat.id);
      }
    } catch (err) {
      // Same reason as /start above — a failed reply or consent-clear is
      // logged, never a non-2xx that Telegram would retry.
      console.error(`telegram webhook: ${cmd} handling failed`, err);
    }
  }

  return NextResponse.json({ ok: true });
}
