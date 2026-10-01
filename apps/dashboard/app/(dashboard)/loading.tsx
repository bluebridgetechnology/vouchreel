export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status">
      <span className="sr-only">Loading</span>
      <div
        className="h-8 w-48 animate-pulse rounded-md bg-muted"
        aria-hidden="true"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-lg border bg-muted/50"
            aria-hidden="true"
          />
        ))}
      </div>
      <div
        className="h-64 animate-pulse rounded-lg border bg-muted/50"
        aria-hidden="true"
      />
    </div>
  );
}
