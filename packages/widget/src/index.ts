import { startWidget, initLoader } from "./loader";
import { VouchreelWidget } from "./widget";
import { setupTrigger } from "./triggers";
import { createVideoPlayer } from "./player";
import { filterTestimonials, matchPattern, matchTags, isPageAllowed } from "./matcher";
import { AnalyticsTracker } from "./analytics";

// Automatically start widget loader in browser environment
startWidget();

// Export public APIs
export {
  startWidget,
  initLoader,
  VouchreelWidget,
  setupTrigger,
  createVideoPlayer,
  filterTestimonials,
  matchPattern,
  matchTags,
  isPageAllowed,
  AnalyticsTracker,
};
