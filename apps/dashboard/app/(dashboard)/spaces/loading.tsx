import { CardGridSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading spaces" className="space-y-6">
      <PageHeaderSkeleton action />
      <CardGridSkeleton count={3} />
    </SkeletonRegion>
  );
}
