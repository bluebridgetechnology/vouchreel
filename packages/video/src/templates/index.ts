import type React from "react";
import type { ReviewVideoProps } from "../types";
import { DarkCard } from "./DarkCard";
import { Minimal } from "./Minimal";
import { RatingSpotlight } from "./RatingSpotlight";
import { ReviewStack } from "./ReviewStack";
import { Spotlight } from "./Spotlight";

/** Component for each template id. Keep in sync with TEMPLATES in ../registry.ts (a test enforces it). */
export const TEMPLATE_COMPONENTS: Record<string, React.FC<ReviewVideoProps>> = {
  spotlight: Spotlight,
  minimal: Minimal,
  "dark-card": DarkCard,
  stack: ReviewStack,
  "rating-spotlight": RatingSpotlight,
};
