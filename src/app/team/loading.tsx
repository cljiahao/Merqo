export default function TeamLoading() {
  return (
    <>
      <div className="sticky top-0 z-40 h-14 border-b bg-background/85 backdrop-blur" />
      <main className="mx-auto max-w-4xl space-y-8 px-5 py-8">
        <div>
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded-md bg-muted" />
        </div>

        <section>
          <div className="h-5 w-28 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <div className="h-9 w-full animate-pulse rounded-md bg-muted sm:max-w-xs" />
            <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
          </div>
        </section>

        <section>
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
          <ul className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                key={i}
                className="flex items-center justify-between rounded-xl border bg-card p-3.5 shadow-sm"
                aria-hidden
              >
                <div className="h-4 w-52 animate-pulse rounded bg-muted" />
                <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
