// Net Promoter Score — the vendor→Merqo loyalty metric, ported from qkit's
// own src/lib/nps.ts (the vendor→qkit equivalent). Promoters score 9–10,
// passives 7–8, detractors 0–6. NPS = (%promoters − %detractors), an
// integer from −100 to 100.

export type NpsBreakdown = {
  total: number;
  promoters: number;
  passives: number;
  detractors: number;
  score: number | null;
};

export function npsBreakdown(scores: number[]): NpsBreakdown {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const s of scores) {
    if (!Number.isFinite(s) || s < 0 || s > 10) continue;
    if (s >= 9) promoters++;
    else if (s >= 7) passives++;
    else detractors++;
  }
  const total = promoters + passives + detractors;
  const score = total
    ? Math.round(((promoters - detractors) / total) * 100)
    : null;
  return { total, promoters, passives, detractors, score };
}
