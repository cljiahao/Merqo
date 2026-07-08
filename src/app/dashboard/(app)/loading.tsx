export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
