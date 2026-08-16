"use server";

import { revalidatePath } from "next/cache";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { generateLinkToken } from "@/lib/telegram";
import { qrSvg } from "@/lib/qr";
import type { ActionResult } from "@/lib/action-result";

const LINK_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Mints a `kind='vendor'` Telegram connect-link token for the signed-in
 * vendor and returns the deep link + a rendered QR SVG — merqo's own
 * profile page mints this directly (same app as
 * `src/app/api/merqo/vendor-connect-token/route.ts`, which does the same
 * thing over HTTP for qkit/loopkit), no HTTP hop needed. `kit_slug:
 * "merqo"` for bookkeeping — this link isn't scoped to any one kit's
 * event.
 */
export async function mintVendorTelegramConnectToken(): Promise<
  ActionResult<{ deepLink: string; qrSvgMarkup: string }>
> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername) {
    console.error(
      "mintVendorTelegramConnectToken: TELEGRAM_BOT_USERNAME is unset",
    );
    return { success: false, error: "Telegram isn't set up yet" };
  }

  const token = generateLinkToken();
  const service = await createServiceClient();
  const { error } = await service.from("telegram_link_tokens").insert({
    token,
    vendor_id: user.id,
    kit_slug: "merqo",
    kind: "vendor",
    expires_at: new Date(Date.now() + LINK_TOKEN_TTL_MS).toISOString(),
  });
  if (error) {
    console.error(
      "mintVendorTelegramConnectToken: insert failed",
      error.message,
    );
    return { success: false, error: "Could not create a connect token" };
  }

  const deepLink = `https://t.me/${botUsername}?start=${token}`;
  const qrSvgMarkup = await qrSvg(deepLink);
  return { success: true, deepLink, qrSvgMarkup };
}

/**
 * Unlinks the signed-in vendor's Telegram chat — deletes their
 * `merqo.vendor_telegram` row. That table grants `authenticated` SELECT
 * only (no client write grant), so the delete goes through the
 * service-role client, scoped to the caller's own `vendor_id`.
 */
export async function disconnectVendorTelegram(): Promise<ActionResult> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not signed in" };

  const service = await createServiceClient();
  const { error } = await service
    .from("vendor_telegram")
    .delete()
    .eq("vendor_id", user.id);
  if (error) {
    console.error("disconnectVendorTelegram failed", error.message);
    return { success: false, error: "Could not disconnect Telegram" };
  }

  revalidatePath("/profile");
  return { success: true };
}
