import { CardGridSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading pricing">
      <div className="mx-auto max-w-6xl space-y-10 px-5 py-16 sm:px-8"><div className="mx-auto max-w-xl space-y-3"><Skeleton className="mx-auto h-6 w-24 rounded-pill" /><Skeleton className="mx-auto h-12 w-full" /><Skeleton className="mx-auto h-5 w-3/4" /></div><CardGridSkeleton count={3} /></div>
    </SkeletonRegion>
  );
}
