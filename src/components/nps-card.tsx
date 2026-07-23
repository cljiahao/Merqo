import { npsBreakdown } from "@/lib/nps";

export function NpsCard({
  title,
  scores,
}: {
  title: string;
  scores: number[];
}) {
  const nps = npsBreakdown(scores);
  return (
    <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-2 flex items-end gap-3">
        <span className="font-display text-5xl font-bold">
          {nps.score ?? "-"}
        </span>
        <span className="pb-1 font-mono text-sm text-muted-foreground">
          {nps.total} response{nps.total === 1 ? "" : "s"}
        </span>
      </div>
      {nps.total > 0 && (
        <>
          <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-muted">
            {nps.detractors > 0 && (
              <div
                style={{ flexGrow: nps.detractors / nps.total }}
                className="bg-destructive"
              />
            )}
            {nps.passives > 0 && (
              <div
                style={{ flexGrow: nps.passives / nps.total }}
                className="bg-muted-foreground/40"
              />
            )}
            {nps.promoters > 0 && (
              <div
                style={{ flexGrow: nps.promoters / nps.total }}
                className="bg-primary"
              />
            )}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-muted-foreground">
            <span>{nps.detractors} detractors</span>
            <span>{nps.passives} passive</span>
            <span>{nps.promoters} promoters</span>
          </div>
        </>
      )}
    </section>
  );
}
