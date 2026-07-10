import type { RegistryRow } from "@/lib/products";

type DowngradeRequestSource = Pick<RegistryRow, "app_url" | "metrics_secret">;

export type DowngradeRequestResult =
  { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Could not send your request. Try again in a moment.";

/** Ask one kit to instantly flip this email back to free. Never throws —
 *  mirrors requestKitUpgrade's/checkVendorStatus's never-throw error
 *  handling so a kit being down degrades to a vendor-facing error message,
 *  not a crash. */
export async function requestKitDowngrade(
  kit: DowngradeRequestSource,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<DowngradeRequestResult> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { success: false, error: GENERIC_ERROR };
  }

  let url: URL;
  try {
    url = new URL("/api/merqo/downgrade-request", kit.app_url);
  } catch {
    return { success: false, error: GENERIC_ERROR };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kit.metrics_secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { success: false, error: GENERIC_ERROR };

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { success: false, error: GENERIC_ERROR };
    }
    if (
      typeof json === "object" &&
      json !== null &&
      (json as { success?: unknown }).success === true
    ) {
      return { success: true };
    }
    return { success: false, error: GENERIC_ERROR };
  } catch {
    return { success: false, error: GENERIC_ERROR };
  } finally {
    clearTimeout(timer);
  }
}
