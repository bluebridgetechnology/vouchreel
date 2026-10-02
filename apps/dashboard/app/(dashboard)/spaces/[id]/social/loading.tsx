import { ChartSkeleton, FormSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading social export settings" className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"><FormSkeleton fields={4} /><ChartSkeleton /></div>
    </SkeletonRegion>
  );
}
