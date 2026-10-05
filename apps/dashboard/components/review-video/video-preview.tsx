"use client";

import dynamic from "next/dynamic";
import type { Aspect, ReviewVideoProps } from "@vouchreel/video";
import { Spinner } from "@/components/ui/spinner";

/**
 * Live preview: the real template composition played in the browser by Remotion's player. Loaded on
 * demand so the player and Remotion are only downloaded when a preview is actually shown.
 */
const ReviewVideoPreview = dynamic(() => import("@vouchreel/video/player").then((m) => m.ReviewVideoPreview), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-card bg-surface-sunken">
      <Spinner label="Loading preview" />
    </div>
  ),
});

export interface VideoPreviewProps {
  templateId: string;
  aspect: Aspect;
  props: ReviewVideoProps;
}

export function VideoPreview({ templateId, aspect, props }: VideoPreviewProps) {
  return <ReviewVideoPreview templateId={templateId} aspect={aspect} props={props} fontBaseUrl="/video-fonts" className="text-xs text-text-muted" />;
}
