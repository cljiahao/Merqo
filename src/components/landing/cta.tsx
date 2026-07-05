import { Button } from "@/components/ui/button";
import { QKIT_URL } from "@/lib/kits";
import { ArrowRight } from "lucide-react";

export function Cta() {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Start with qkit today.
          </h2>
          <p className="mt-2 max-w-md text-primary-foreground/80">
            Set up your booth, print the QR, and take your first order this
            afternoon. Free to start.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="bg-gold text-gold-foreground hover:bg-gold/90"
        >
          <a href={QKIT_URL}>
            Open qkit
            <ArrowRight className="size-4" />
          </a>
        </Button>
      </div>
    </section>
  );
}
