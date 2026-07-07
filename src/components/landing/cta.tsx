import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function Cta({ authed = false }: { authed?: boolean }) {
  return (
    <section className="bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Run your business from one place.
          </h2>
          <p className="mt-2 max-w-md text-primary-foreground/80">
            Sign in to your Merqo dashboard to manage your kits, your customers,
            and every order across the tools you use.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="bg-gold text-gold-foreground hover:bg-gold/90"
        >
          <Link href={authed ? "/admin" : "/login"}>
            {authed ? "Go to dashboard" : "Get started"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
