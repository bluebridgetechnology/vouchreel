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
  },
});
