import {
  metricsPayloadSchema,
  type MetricsPayload,
} from "@/lib/metrics-schema";
// Type-only import: the canonical registry row lives in products.ts. `import
// type` erases at runtime, so metrics-client stays free of the supabase/server
// (next/headers) dependency and remains trivially unit-testable. We only need
// the metrics-endpoint fields, so take a Pick — a full RegistryRow still fits.
import type { RegistryRow } from "@/lib/products";

type MetricsSource = Pick<
  RegistryRow,
  "slug" | "name" | "metrics_url" | "metrics_secret"
>;

export type MetricsResult =
  | { ok: true; product: string; data: MetricsPayload }
  | {
      ok: false;
      product: string;
      reason: "auth" | "unreachable" | "bad_shape";
    };

export async function fetchProductMetrics(
  p: MetricsSource,
  opts: { timeoutMs?: number } = {},
): Promise<MetricsResult> {
  if (!p.metrics_url || !p.metrics_secret) {
    return { ok: false, product: p.slug, reason: "unreachable" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 5000);
  try {
    const res = await fetch(p.metrics_url, {
      headers: { Authorization: `Bearer ${p.metrics_secret}` },
      cache: "no-store",
      signal: controller.signal,
    });
    if (res.status === 401)
      return { ok: false, product: p.slug, reason: "auth" };
    if (!res.ok) return { ok: false, product: p.slug, reason: "unreachable" };

    // Past a 200, a body we can't read/validate is a product-side problem
    // (bad_shape), not a network outage (unreachable) — keep them distinct so
    // on-call debugging points at the right layer.
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, product: p.slug, reason: "bad_shape" };
    }
    const parsed = metricsPayloadSchema.safeParse(json);
    if (!parsed.success)
      return { ok: false, product: p.slug, reason: "bad_shape" };
    return { ok: true, product: p.slug, data: parsed.data };
  } catch {
    return { ok: false, product: p.slug, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
