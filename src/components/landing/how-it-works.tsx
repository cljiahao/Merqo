import { ListChecks, QrCode, Bell } from "lucide-react";

// A real ordered sequence (you can't watch orders before printing the QR), so
// the numbered markers here encode something true — not decoration.
const STEPS = [
  {
    icon: ListChecks,
    title: "Build your booth",
    body: "Add your items, photos, and prices in minutes. Queue-only or priced — your call.",
  },
  {
    icon: QrCode,
    title: "Print the QR",
    body: "Each booth gets a printable QR poster. Stick it on the stall; customers scan to order.",
  },
  {
    icon: Bell,
    title: "Watch orders land",
    body: "Orders hit your live board in real time. Move them preparing → ready → done.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-t">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          How qkit works
        </p>
        <h2 className="mt-3 max-w-xl font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Live in an afternoon. Nothing to install.
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-semibold text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="h-px flex-1 bg-border" />
                <s.icon className="size-5 text-primary" aria-hidden />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
