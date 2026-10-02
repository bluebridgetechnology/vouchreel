import { PageHeaderSkeleton, SkeletonRegion, StatGridSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading agency dashboard" className="space-y-6">
      <PageHeaderSkeleton action />
      <StatGridSkeleton />
      <TableSkeleton rows={5} cols={5} />
    </SkeletonRegion>
  );
}
