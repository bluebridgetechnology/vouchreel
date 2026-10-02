import { CardGridSkeleton, ListSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading reviews" className="space-y-6">
      <PageHeaderSkeleton />
      <CardGridSkeleton count={2} className="lg:grid-cols-2" />
      <ListSkeleton rows={2} />
    </SkeletonRegion>
  );
}
