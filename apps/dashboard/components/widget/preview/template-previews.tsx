import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ExpandedReview } from "./preview-types";

/**
 * The three card layouts the preview can mock up on the pretend website. Each one only knows how to draw
 * itself; opening the video or review modal is the parent's job (it owns that state).
 */
export interface TemplatePreviewProps {
  primaryColor: string;
  onVideo: () => void;
  onReview: (review: ExpandedReview) => void;
}

export function WallOfLovePreview({ primaryColor, onVideo, onReview }: TemplatePreviewProps) {
  return (
    <div className="pt-3 space-y-2">
      <div className="text-2xs font-medium text-text">Wall of Love Preview</div>
      <div className="grid grid-cols-2 gap-2">
        {/* Video Testimonial Card */}
        <button
          type="button"
          onClick={() => onVideo()}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "cursor-pointer")}
        >
          <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1.5">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
              alt="Customer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-6 w-6 rounded-pill flex items-center justify-center text-on-media shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="h-3 w-3 ml-0.5 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          </div>
          <span className="text-3xs font-medium text-brand">📹 Video Testimonial</span>
          <p className="text-2xs text-text line-clamp-2 mt-0.5">
            &ldquo;Conversions spiked immediately!&rdquo;
          </p>
          <p className="text-3xs text-text-muted mt-1">Sarah Johnson • 1:42</p>
        </button>

        {/* Google Review Card */}
        <button
          type="button"
          onClick={() =>
            onReview({
              authorName: "Alex Morgan",
              rating: 5,
              text: "Vouchreel transformed our landing page social proof. Conversions increased by 38% in our first month!",
              provider: "Google Maps",
              date: "2 days ago",
            })
          }
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "cursor-pointer")}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-3xs font-medium px-1.5 py-0.5 rounded-control bg-info-soft text-info-foreground">
                Google
              </span>
              <span className="text-warning text-2xs">★★★★★</span>
            </div>
            <p className="text-2xs text-text line-clamp-3">
              &ldquo;Vouchreel transformed our landing page social proof. Conversions increased by 38%!&rdquo;
            </p>
          </div>
          <p className="text-3xs text-text-muted mt-2 border-t pt-1">
            Alex Morgan • 2 days ago
          </p>
        </button>

        {/* Trustpilot Review Card */}
        <button
          type="button"
          onClick={() =>
            onReview({
              authorName: "Elena Rostova",
              rating: 5,
              text: "Incredible tool. Collecting and displaying customer feedback has never been easier.",
              provider: "Trustpilot",
              date: "1 week ago",
            })
          }
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "cursor-pointer")}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-3xs font-medium px-1.5 py-0.5 rounded-control bg-success-soft text-success-foreground">
                Trustpilot
              </span>
              <span className="text-warning text-2xs">★★★★★</span>
            </div>
            <p className="text-2xs text-text line-clamp-3">
              &ldquo;Incredible tool. Collecting customer feedback has never been easier.&rdquo;
            </p>
          </div>
          <p className="text-3xs text-text-muted mt-2 border-t pt-1">
            Elena Rostova • 1 week ago
          </p>
        </button>

        {/* Second Video Testimonial Card */}
        <button
          type="button"
          onClick={() => onVideo()}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "cursor-pointer")}
        >
          <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1.5">
            <img
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
              alt="Customer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-6 w-6 rounded-pill flex items-center justify-center text-on-media shadow-xs"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="h-3 w-3 ml-0.5 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          </div>
          <span className="text-3xs font-medium text-brand">📹 Video Testimonial</span>
          <p className="text-2xs text-text line-clamp-2 mt-0.5">
            &ldquo;Our best marketing investment.&rdquo;
          </p>
          <p className="text-3xs text-text-muted mt-1">David K. • 0:54</p>
        </button>
      </div>
    </div>
  );
}

export function CarouselPreview({ primaryColor, onVideo, onReview }: TemplatePreviewProps) {
  return (
    <div className="pt-3 space-y-2">
      <div className="text-2xs font-medium text-text">Carousel Preview</div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {/* Card 1: Video */}
        <button
          type="button"
          onClick={() => onVideo()}
          className="flex flex-col text-left shrink-0 w-36 rounded-card border bg-surface/80 p-2 shadow-xs hover:border-brand/50 cursor-pointer"
        >
          <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
              alt="Customer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="h-5 w-5 rounded-pill flex items-center justify-center text-on-media"
                style={{ backgroundColor: primaryColor }}
              >
                <svg className="h-2.5 w-2.5 ml-0.5 fill-current" viewBox="0 0 24 24">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
            </div>
          </div>
          <p className="text-3xs font-medium text-text truncate">Sarah Johnson</p>
          <p className="text-3xs text-text-muted line-clamp-1">&ldquo;Doubled conversions&rdquo;</p>
        </button>

        {/* Card 2: Google Review */}
        <button
          type="button"
          onClick={() =>
            onReview({
              authorName: "Alex Morgan",
              rating: 5,
              text: "Vouchreel transformed our landing page social proof. Highly recommend!",
              provider: "Google Maps",
              date: "2 days ago",
            })
          }
          className="flex flex-col text-left shrink-0 w-36 rounded-card border bg-surface/80 p-2 shadow-xs hover:border-brand/50 cursor-pointer justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-3xs font-medium px-1 rounded-control bg-info-soft text-info-foreground">Google</span>
              <span className="text-warning text-3xs">★★★★★</span>
            </div>
            <p className="text-3xs text-text line-clamp-2">
              &ldquo;Transformed our social proof!&rdquo;
            </p>
          </div>
          <p className="text-3xs text-text-muted mt-1 border-t pt-0.5">Alex M.</p>
        </button>

        {/* Card 3: Trustpilot Review */}
        <button
          type="button"
          onClick={() =>
            onReview({
              authorName: "Elena Rostova",
              rating: 5,
              text: "Incredible tool. Collecting customer feedback has never been easier.",
              provider: "Trustpilot",
              date: "1 week ago",
            })
          }
          className="flex flex-col text-left shrink-0 w-36 rounded-card border bg-surface/80 p-2 shadow-xs hover:border-brand/50 cursor-pointer justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-3xs font-medium px-1 rounded-control bg-success-soft text-success-foreground">Trustpilot</span>
              <span className="text-warning text-3xs">★★★★★</span>
            </div>
            <p className="text-3xs text-text line-clamp-2">
              &ldquo;Never been easier to gather proof.&rdquo;
            </p>
          </div>
          <p className="text-3xs text-text-muted mt-1 border-t pt-0.5">Elena R.</p>
        </button>
      </div>
    </div>
  );
}

export function MasonryPreview({ onVideo, onReview }: Omit<TemplatePreviewProps, "primaryColor">) {
  return (
    <div className="pt-3 space-y-2">
      <div className="text-2xs font-medium text-text">Masonry Grid Preview</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onVideo()}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "w-full cursor-pointer")}
          >
            <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
                alt="Customer"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-3xs font-medium text-text">Sarah J. • 1:42</p>
            <p className="text-3xs text-text-muted">&ldquo;Super simple to use&rdquo;</p>
          </button>
          <button
            type="button"
            onClick={() =>
              onReview({
                authorName: "Elena Rostova",
                rating: 5,
                text: "Very polished widget and easy integration.",
                provider: "Trustpilot",
                date: "1 week ago",
              })
            }
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "w-full cursor-pointer")}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-3xs font-medium px-1 rounded-control bg-success-soft text-success-foreground">Trustpilot</span>
              <span className="text-warning text-3xs">★★★★★</span>
            </div>
            <p className="text-3xs text-text">&ldquo;Very polished widget and easy integration.&rdquo;</p>
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() =>
              onReview({
                authorName: "Alex Morgan",
                rating: 5,
                text: "Top-tier social proof tool. The video plus text blends seamlessly.",
                provider: "Google Maps",
                date: "2 days ago",
              })
            }
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "w-full cursor-pointer")}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-3xs font-medium px-1 rounded-control bg-info-soft text-info-foreground">Google</span>
              <span className="text-warning text-3xs">★★★★★</span>
            </div>
            <p className="text-3xs text-text">&ldquo;Top-tier social proof tool. The video plus text blends seamlessly.&rdquo;</p>
          </button>
          <button
            type="button"
            onClick={() => onVideo()}
            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "w-full cursor-pointer")}
          >
            <div className="relative aspect-video w-full rounded-control bg-scrim overflow-hidden mb-1">
              <img
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
                alt="Customer"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-3xs font-medium text-text">David K. • 0:54</p>
          </button>
        </div>
      </div>
    </div>
  );
}
