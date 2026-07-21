type FaqEntry = { q: string; a: string };

const FAQ: FaqEntry[] = [
  {
    q: "What is Merqo?",
    a: 'Merqo is the house brand behind a family of small-business tools ("kits") for Singapore micro/small sellers — qkit, loopkit, paykit, and stockkit today.',
  },
  {
    q: "Do I need to sign up for every kit separately?",
    a: "No — one account works across the whole family. Your stall name and social links carry over automatically between kits.",
  },
  {
    q: "Can I use just one kit?",
    a: "Yes. Every kit works standalone — use only the ones you need.",
  },
  {
    q: "Is Merqo itself something I sign up for separately?",
    a: "No. Merqo is the account and dashboard layer over the kits you already use, not a separate product to purchase.",
  },
];

function FaqItem({ q, a }: FaqEntry) {
  return (
    <details className="group overflow-hidden rounded-xl border bg-card open:border-primary/50">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset">
        <span className="text-base font-display font-semibold leading-snug">
          {q}
        </span>
        <span
          aria-hidden
          className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="px-5 pb-5 text-sm leading-relaxed text-foreground/80">
        {a}
      </div>
    </details>
  );
}

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-16">
      <h2 className="mb-10 text-center text-3xl font-display font-bold tracking-tight">
        Questions
      </h2>
      <div className="space-y-3">
        {FAQ.map((item) => (
          <FaqItem key={item.q} {...item} />
        ))}
      </div>
    </section>
  );
}
