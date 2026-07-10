/** Small chrome-frame wrapper (browser-bar dots) around a handful of real
 *  domain objects — NOT a fake screenshot. Research into how premium
 *  products (Linear, Stripe, Vercel) illustrate their own UI found that
 *  faking a full "screen" reads as cheap; this frame + a real object inside
 *  it (a stamp row, a ticket number) is the concrete, well-precedented
 *  alternative. Shadow-as-border edge instead of a flat `border`, one accent
 *  color max inside, static — no idle animation. */
export function MockupWindow({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
        <span
          aria-hidden
          className="size-2 rounded-full bg-muted-foreground/25"
        />
        <span
          aria-hidden
          className="size-2 rounded-full bg-muted-foreground/25"
        />
        <span
          aria-hidden
          className="size-2 rounded-full bg-muted-foreground/25"
        />
      </div>
      <div className="flex items-center justify-center bg-card px-6 py-8">
        {children}
      </div>
    </div>
  );
}
