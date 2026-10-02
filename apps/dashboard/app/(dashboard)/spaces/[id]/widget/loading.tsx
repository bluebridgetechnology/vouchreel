import { CardGridSkeleton, ChartSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading widget settings" className="space-y-6">
      <PageHeaderSkeleton action />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><CardGridSkeleton count={4} className="lg:grid-cols-2" /><ChartSkeleton /></div>
    </SkeletonRegion>
  );
}
