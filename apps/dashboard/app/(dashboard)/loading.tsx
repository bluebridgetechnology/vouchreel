import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6" role="status">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-9 w-48" aria-hidden="true" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-card" aria-hidden="true" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-card" aria-hidden="true" />
    </div>
  );
}
