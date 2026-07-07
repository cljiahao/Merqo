export default function DashboardLoading() {
  return (
    <>
      <div className="sticky top-0 z-40 h-14 border-b bg-background/85 backdrop-blur" />
      <main className="mx-auto max-w-6xl px-5 py-8">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded-md bg-muted" />

        <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-4 shadow-sm"
              aria-hidden
            >
              <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              <div className="mt-3 h-7 w-16 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </section>

        <div className="mt-10 h-6 w-28 animate-pulse rounded-md bg-muted" />
        <section className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border bg-card p-5 shadow-sm"
              aria-hidden
            >
              <div className="flex items-center justify-between gap-3">
                <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                <div className="h-5 w-12 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((__, j) => (
                  <div
                    key={j}
                    className="h-4 w-full animate-pulse rounded bg-muted"
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
