import { CardGridSkeleton, FormSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading brand settings" className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <FormSkeleton fields={4} />
        </div>
        <div className="lg:col-span-2">
          <CardGridSkeleton count={1} />
        </div>
      </div>
    </SkeletonRegion>
  );
}
