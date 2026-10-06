import { defineConfig } from "@playwright/test";

/**
 * End-to-end smoke tests (npm run test:e2e). They drive a production build against a THROWAWAY
 * Postgres that already has the migrations applied:
 *
 *   createdb vouchreel_e2e && DATABASE_URL=postgres://.../vouchreel_e2e npm run db:migrate
 *   npm run build:e2e        (the browser's sign-in URL is baked in at build time, so it must use the e2e port)
 *   E2E_DATABASE_URL=postgres://.../vouchreel_e2e npm run test:e2e
 *
 * Set E2E_PORT only if you also change the port in the build:e2e script.
 * The seed step deletes and recreates rows whose names start with "e2e", and refuses to run
 * unless the database name contains "e2e" or "test".
 */
const PORT = Number(process.env.E2E_PORT ?? 3101);
const STORAGE_PORT = Number(process.env.E2E_STORAGE_PORT ?? 3199);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // The tests change shared rows (a plan grant, a retried job), so they run one after another
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "./e2e/.results",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
      BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456",
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
      // Takedowns delete files through the real S3 client; e2e/fake-s3.ts answers it
      STORAGE_PROVIDER: "r2",
      STORAGE_ENDPOINT: `http://127.0.0.1:${STORAGE_PORT}`,
      STORAGE_BUCKET: "e2e-bucket",
      STORAGE_KEY: "e2e",
      STORAGE_SECRET: "e2e",
    },
  },
});
