export const PASSWORD = "E2e-Passw0rd!Passw0rd";
export const USERS = {
  admin: { name: "E2E Admin", email: "e2e-admin@example.test" },
  member: { name: "E2E Member", email: "e2e-member@example.test" },
  customer: { name: "E2E Customer", email: "e2e-customer@example.test" },
  promote: { name: "E2E Promote", email: "e2e-promote@example.test" },
  billed: { name: "E2E Billed", email: "e2e-billed@example.test" },
} as const;
export const PLAN_NAME = "E2E Plan";
export const FAILED_JOB_ERROR = "E2E render failed: chromium missing";
/** Job types nothing consumes, so a running server never touches these rows. */
export const FAILED_JOB_TYPE = "e2e_failed_probe";
export const QUEUED_JOB_TYPE = "e2e_queued_probe";
export const AUDIT_SEED_COUNT = 60;
export const ADMIN_STATE = "e2e/.auth/admin.json";

export const STORAGE_PORT = Number(process.env.E2E_STORAGE_PORT ?? 3199);
export const STORAGE_BUCKET = "e2e-bucket";
export const STORAGE_ORIGIN = `http://127.0.0.1:${STORAGE_PORT}`;
export const REASON_TEXT = "Customer asked us to remove it";
/** Signs consent-withdrawal links and the session cookies: shared by the web server's env and the seed. */
export const E2E_AUTH_SECRET = "e2e-secret-e2e-secret-e2e-secret-123456";
export const CONSENT_FILE = "e2e/.auth/consent.json";
