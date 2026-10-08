import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  test: {
    environment: "node",
    // Videos from Google and Trustpilot reviews are off unless switched on (lib/review-video/sources.ts); the tests use them
    env: { REVIEW_VIDEO_SOURCES: "google,trustpilot,own" },
    // Playwright specs (npm run test:e2e) are not unit tests
    exclude: ["**/node_modules/**", "**/.next/**", "e2e/**"],
  },
});
