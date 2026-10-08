import type { WidgetTheme } from "@/lib/validations/widget-config";
import type { ExpandedReview } from "./preview-types";

/** The two pop-ups the preview can show over the pretend website, laid out the way the widget lays them out. */
interface ModalProps {
  viewport: "desktop" | "mobile";
  isDark: boolean;
  theme: WidgetTheme;
  onClose: () => void;
}

export function VideoPreviewModal({ viewport, isDark, theme, onClose }: ModalProps) {
  const primaryColor = theme.primaryColor;
  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-scrim/60 backdrop-blur-xs p-3 transition-opacity ${
        viewport === "mobile" ? "items-end p-0" : ""
      }`}
    >
      <div
        className={`relative w-full overflow-hidden shadow-float transition-all ${
          viewport === "mobile"
            ? "rounded-t-2xl border-t border-border"
            : "max-w-[280px] border border-border"
        } ${isDark ? "bg-surface-inverse text-on-media" : "bg-surface text-text"}`}
        style={{
          borderRadius:
            viewport === "mobile"
              ? `${theme.borderRadius}px ${theme.borderRadius}px 0 0`
              : `${theme.borderRadius}px`,
        }}
      >
        {/* Close Preview Button */}
        <button
          type="button"
          aria-label="Close preview modal"
          onClick={() => onClose()}
          className="absolute right-2.5 top-2.5 z-40 flex h-6 w-6 items-center justify-center rounded-pill bg-scrim/50 text-on-media hover:bg-scrim/70"
          title="Close preview modal"
        >
          ×
        </button>

        {/* Video Player Mock */}
        <div className="relative aspect-[9/14] max-h-[300px] w-full overflow-hidden bg-scrim">
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80"
            alt="Customer Video"
            className="h-full w-full object-cover opacity-85"
          />

          {/* Centered Big Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-pill shadow-float transition-transform hover:scale-110 cursor-pointer"
              style={{
                backgroundColor: primaryColor,
                color: theme.accentColor,
              }}
            >
              <svg className="h-5 w-5 ml-0.5 fill-current" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            </div>
          </div>

          {/* Video Progress Bar */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-on-media/20">
            <div
              className="h-full w-1/3"
              style={{ backgroundColor: primaryColor }}
            />
          </div>
        </div>

        {/* Modal Details Section */}
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium leading-tight">
                Sarah Johnson
              </div>
              <div className="text-2xs text-text-muted">
                Founder, CloudScale
              </div>
            </div>
            <span
              className="rounded-control px-1.5 py-0.5 text-3xs font-medium"
              style={{
                backgroundColor: `${primaryColor}20`,
                color: primaryColor,
              }}
            >
              Verified
            </span>
          </div>

          <p className="text-2xs italic leading-snug">
            &ldquo;Vouchreel completely transformed our marketing funnel. Our landing page conversion shot up 34%!&rdquo;
          </p>

          <div className="pt-1">
            <button
              type="button"
              className="w-full py-1.5 text-center text-xs font-medium shadow-xs"
              style={{
                backgroundColor: primaryColor,
                color: theme.accentColor,
                borderRadius: `${Math.max(4, theme.borderRadius - 4)}px`,
              }}
            >
              Get Started Like Sarah
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReviewPreviewModal({ viewport, isDark, theme, review, onClose }: ModalProps & { review: ExpandedReview }) {
  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-scrim/60 backdrop-blur-xs p-3 transition-opacity ${
        viewport === "mobile" ? "items-end p-0" : ""
      }`}
    >
      <div
        className={`relative w-full overflow-hidden shadow-float transition-all ${
          viewport === "mobile"
            ? "rounded-t-2xl border-t border-border"
            : "max-w-[280px] border border-border"
        } ${isDark ? "bg-surface-inverse text-on-media" : "bg-surface text-text"}`}
        style={{
          borderRadius:
            viewport === "mobile"
              ? `${theme.borderRadius}px ${theme.borderRadius}px 0 0`
              : `${theme.borderRadius}px`,
        }}
      >
        <button
          type="button"
          aria-label="Close review modal"
          onClick={() => onClose()}
          className="absolute right-2.5 top-2.5 z-40 flex h-6 w-6 items-center justify-center rounded-pill bg-scrim/20 text-text hover:bg-scrim/40 cursor-pointer"
        >
          ✕
        </button>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-2xs font-medium px-2 py-0.5 rounded-control bg-brand-soft text-brand">
              {review.provider}
            </span>
            <span className="text-warning text-xs">
              {Array.from({ length: 5 }).map((_, i) =>
                i < review.rating ? "★" : "☆"
              )}
            </span>
          </div>

          <p className="text-xs text-text/90 italic leading-relaxed">
            &ldquo;{review.text}&rdquo;
          </p>

          <div className="pt-2 border-t flex items-center justify-between text-2xs text-text-muted">
            <span className="font-medium text-text">
              {review.authorName}
            </span>
            <span>{review.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
