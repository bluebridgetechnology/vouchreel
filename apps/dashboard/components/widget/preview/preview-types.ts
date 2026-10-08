import type { TriggerType } from "@/lib/validations/widget-config";

/** A review shown larger in the preview's pop-up. */
export interface ExpandedReview {
  authorName: string;
  rating: number;
  text: string;
  provider: string;
  date: string;
}

/** The line next to the preview title that says when the widget would appear. */
export function triggerLabel(triggerType: TriggerType, triggerValue: Record<string, unknown>): string {
  switch (triggerType) {
    case "delay":
      return `Trigger: ${triggerValue.seconds ?? 5}s delay`;
    case "scroll-depth":
      return `Trigger: ${triggerValue.percentage ?? 50}% scroll`;
    case "pageview-count":
      return `Trigger: ${triggerValue.count ?? 2} pageviews`;
    case "exit-intent":
      return "Trigger: Exit intent";
    case "returning-visitor":
      return "Trigger: Returning visitor";
    default:
      return "Trigger: Instant";
  }
}
