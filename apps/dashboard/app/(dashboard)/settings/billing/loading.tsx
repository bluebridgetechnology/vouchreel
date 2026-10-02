import { FormSkeleton, PageHeaderSkeleton, SkeletonRegion, StatGridSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading billing" className="space-y-6">
      <PageHeaderSkeleton />
      <StatGridSkeleton count={3} />
      <FormSkeleton fields={1} />
    </SkeletonRegion>
  );
}
