import { FormSkeleton, ListSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading collection forms" className="space-y-6">
      <PageHeaderSkeleton />
      <FormSkeleton fields={3} />
      <ListSkeleton rows={2} />
    </SkeletonRegion>
  );
}
