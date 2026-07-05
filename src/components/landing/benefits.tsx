import { Boxes, KeyRound, Store } from "lucide-react";

const BENEFITS = [
  {
    icon: Boxes,
    title: "One brand, many tools",
    body: "Merqo is a growing kit of small-business tools. Pick the ones you need — they're built to work together, not against each other.",
  },
  {
    icon: KeyRound,
    title: "One account across every kit",
    body: "Sign in once. Your customers, orders, and settings carry across the kits you switch on, so nothing is entered twice.",
  },
  {
    icon: Store,
    title: "Built for SG micro-sellers",
    body: "Made for home kitchens, pop-ups, and new cafes — plain language, PayNow-friendly, and priced for a stall, not a chain.",
  },
];

export function Benefits() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <div className="grid gap-8 sm:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title}>
            <b.icon className="size-6 text-primary" aria-hidden />
            <h3 className="mt-4 font-display text-lg font-bold">{b.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {b.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
