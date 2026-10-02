import { FormSkeleton, PageHeaderSkeleton, SkeletonRegion, TableSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading webhooks" className="space-y-6">
      <PageHeaderSkeleton />
      <FormSkeleton fields={2} />
      <TableSkeleton rows={3} cols={4} />
    </SkeletonRegion>
  );
}
