import { FormSkeleton, PageHeaderSkeleton, SkeletonRegion } from "@/components/ui/page-skeleton";

export default function Loading() {
  return (
    <SkeletonRegion label="Loading" className="space-y-6">
      <div className="mx-auto max-w-2xl space-y-6"><PageHeaderSkeleton /><FormSkeleton fields={2} /></div>
    </SkeletonRegion>
  );
}
