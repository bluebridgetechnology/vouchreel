import { CardGridSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading settings" className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={3} />
    </SkeletonRegion>
  );
}
