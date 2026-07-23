import { requireMerqoTeam } from "@/lib/team";
import { createServerClient } from "@/lib/supabase/server";
import { NpsCard } from "@/components/nps-card";

export const revalidate = 0;

function when(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export default async function AdminFeedbackPage() {
  await requireMerqoTeam();
  const supabase = await createServerClient();
  const { data: rows, error } = await supabase
    .from("feedback")
    .select("id, nps, message, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  // A query error is a config/grant fault, NOT "no feedback yet" — surface it
  // loudly rather than silently rendering an empty state.
  if (error) throw new Error(`feedback read failed: ${error.message}`);
  const all = rows ?? [];
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

      <NpsCard
        title="Vendor NPS · how vendors rate Merqo"
        scores={all.map((f) => f.nps as number)}
      />

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
