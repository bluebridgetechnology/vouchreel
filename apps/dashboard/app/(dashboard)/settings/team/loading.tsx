import { PageHeaderSkeleton, SkeletonRegion, TableSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading team" className="space-y-6">
      <PageHeaderSkeleton action />
      <TableSkeleton rows={4} cols={4} />
    </SkeletonRegion>
  );
}
