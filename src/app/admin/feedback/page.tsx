import { requireMerqoTeam } from "@/lib/team";
import { createServerClient } from "@/lib/supabase/server";
import { npsBreakdown } from "@/lib/nps";

export const revalidate = 0;

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export default async function AdminFeedbackPage() {
  await requireMerqoTeam();
  const supabase = await createServerClient();
  const { data: rows } = await supabase
    .from("feedback")
    .select("id, nps, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const all = rows ?? [];
  const nps = npsBreakdown(all.map((f) => f.nps as number));
  const comments = all.filter((f) => (f.message as string | null)?.trim());

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Feedback
        </h1>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Vendor NPS · how vendors rate Merqo
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

      {comments.length > 0 && (
        <section className="mt-6 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Comments
          </h2>
          {comments.map((f) => (
            <div
              key={f.id as string}
              className="rounded-xl border bg-card p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                  NPS {f.nps as number}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {when(f.created_at as string)}
                </span>
              </div>
              <p className="mt-2 text-sm">{f.message as string}</p>
            </div>
          ))}
        </section>
      )}

      {all.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No feedback yet.
        </div>
      )}
    </main>
  );
}
