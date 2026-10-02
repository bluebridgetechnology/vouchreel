import { PageHeaderSkeleton, SkeletonRegion, TableSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading notification settings" className="max-w-4xl space-y-6">
      <PageHeaderSkeleton />
      <TableSkeleton rows={7} cols={3} />
    </SkeletonRegion>
  );
}
