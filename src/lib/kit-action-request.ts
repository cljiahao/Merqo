import { z } from "zod";
import type { RegistryRow } from "@/lib/products";

export type FetchKitJsonResult<T> =
  | { ok: true; status: number; data: T }
  | {
      ok: false;
      status: number | null;
      kind: "network" | "http" | "parse" | "schema";
    };

interface KitJsonSchema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false };
}

/** Fetch `url` with a timeout, parse the body as JSON, and validate it
 *  against `schema`. Never throws — every failure mode (network error,
 *  non-2xx status, non-JSON body, schema mismatch) collapses to a
 *  discriminated `ok: false` result carrying the HTTP status (when one was
 *  received) and a `kind`, so each caller can map it onto its own
 *  domain-specific result shape without repeating the AbortController /
 *  timeout / try-catch-parse-then-safeParse scaffolding. */
export async function fetchKitJson<T>(
  url: string | URL,
  schema: KitJsonSchema<T>,
  init: RequestInit = {},
  timeoutMs = 5000,
): Promise<FetchKitJsonResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, status: res.status, kind: "http" };

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, status: res.status, kind: "parse" };
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success)
      return { ok: false, status: res.status, kind: "schema" };
    return { ok: true, status: res.status, data: parsed.data };
  } catch {
    return { ok: false, status: null, kind: "network" };
  } finally {
    clearTimeout(timer);
  }
}

type KitActionSource = Pick<RegistryRow, "app_url" | "metrics_secret">;

export type KitActionResult =
  { success: true } | { success: false; error: string };

const GENERIC_ERROR = "Could not send your request. Try again in a moment.";

const kitActionResponseSchema = z.object({ success: z.literal(true) });

/** POST an email-keyed action to one kit's merqo-integration API and report
 *  success/failure. Never throws — shared by requestKitUpgrade and
 *  requestKitDowngrade so a kit being down degrades to a vendor-facing
 *  error message, not a crash. */
export async function postKitAction(
  kit: KitActionSource,
  path: string,
  email: string,
  opts: { timeoutMs?: number } = {},
): Promise<KitActionResult> {
  if (!kit.app_url || !kit.metrics_secret) {
    return { success: false, error: GENERIC_ERROR };
  }

  let url: URL;
  try {
    url = new URL(path, kit.app_url);
  } catch {
    return { success: false, error: GENERIC_ERROR };
  }

  const result = await fetchKitJson(
    url,
    kitActionResponseSchema,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kit.metrics_secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    },
    opts.timeoutMs ?? 5000,
  );
  return result.ok
    ? { success: true }
    : { success: false, error: GENERIC_ERROR };
}
