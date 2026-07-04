import { metricsPayloadSchema, type MetricsPayload } from "@/lib/metrics-schema";

export type MetricsResult =
  | { ok: true; product: string; data: MetricsPayload }
  | { ok: false; product: string; reason: "auth" | "unreachable" | "bad_shape" };

type RegistryRow = {
  slug: string;
  name: string;
  metrics_url: string | null;
  metrics_secret: string | null;
};

export async function fetchProductMetrics(
  p: RegistryRow,
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
    if (res.status === 401) return { ok: false, product: p.slug, reason: "auth" };
    if (!res.ok) return { ok: false, product: p.slug, reason: "unreachable" };

    const json = await res.json();
    const parsed = metricsPayloadSchema.safeParse(json);
    if (!parsed.success) return { ok: false, product: p.slug, reason: "bad_shape" };
    return { ok: true, product: p.slug, data: parsed.data };
  } catch {
    return { ok: false, product: p.slug, reason: "unreachable" };
  } finally {
    clearTimeout(timer);
  }
}
