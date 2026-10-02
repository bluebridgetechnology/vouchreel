import { ListSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading testimonials" className="space-y-6">
      <PageHeaderSkeleton action />
      <ListSkeleton rows={3} />
    </SkeletonRegion>
  );
}
