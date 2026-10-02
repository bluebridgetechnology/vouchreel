import { ChartSkeleton, PageHeaderSkeleton, SkeletonRegion, StatGridSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading analytics" className="space-y-6">
      <PageHeaderSkeleton />
      <StatGridSkeleton />
      <ChartSkeleton />
      <TableSkeleton rows={4} />
    </SkeletonRegion>
  );
}
