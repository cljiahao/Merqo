import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const TRUST = ["No app", "No hardware", "Free to start"];

/** A tiny "now serving" board — the hero thesis is the live product made
 *  visible, not a big number. Pure markup, no image asset, renders in the
 *  initial HTML for a fast LCP. */
function LiveBoard() {
  const rows = [
    { n: "05", label: "Kaya toast set", tone: "text-muted-foreground" },
    { n: "04", label: "Iced kopi ×2", tone: "text-muted-foreground" },
  ];
  return (
    <div
      aria-hidden
      className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between border-b pb-3">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Now serving
        </span>
        <span className="size-2 rounded-full bg-primary" />
      </div>
      <div className="py-4 text-center">
        <div className="font-mono text-6xl font-bold tabular-nums text-primary">
          06
        </div>
        <div className="mt-1 text-sm text-muted-foreground">Nasi lemak ×1</div>
      </div>
      <ul className="space-y-2 border-t pt-3">
        {rows.map((r) => (
          <li key={r.n} className="flex items-center gap-3 text-sm">
            <span className="font-mono text-xs text-muted-foreground">
              {r.n}
            </span>
            <span className={r.tone}>{r.label}</span>
            <span className="ml-auto rounded-full bg-gold/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-gold-foreground">
              Ready
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 sm:py-24 lg:grid-cols-2">
      <div>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Merqo · small-business toolkit
        </p>
        <h1 className="mt-4 max-w-xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-5xl">
          Simple tools to run your small business. Starting with queues.
        </h1>
        <p className="mt-5 max-w-md text-lg text-muted-foreground">
          Merqo builds a family of no-fuss tools for Singapore&rsquo;s small
          sellers. Take orders, clear your queue, and keep customers coming back
          &mdash; from a phone, not a POS.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/login">
              Go to dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#kits">See the kits</a>
          </Button>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
          {TRUST.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-gold" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex justify-center lg:justify-end">
        <LiveBoard />
      </div>
    </section>
  );
}
