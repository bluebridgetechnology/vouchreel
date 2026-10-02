import { FormSkeleton, PageHeaderSkeleton, SkeletonRegion, TableSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading admin settings" className="space-y-6">
      <PageHeaderSkeleton />
      <FormSkeleton fields={2} />
      <TableSkeleton rows={3} cols={3} />
    </SkeletonRegion>
  );
}
