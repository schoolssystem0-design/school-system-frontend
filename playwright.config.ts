import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running API. Locally: start the API with
 * `cd backend && mvn spring-boot:test-run -Dspring-boot.run.main-class=com.selectcode.sms.LocalDevApplication`
 * then `npm run e2e` (builds and starts the app on :3000). To test staging, set E2E_BASE_URL.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  // One shared API and dev outbox (step-up codes): run files one after another.
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000/sign-in",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
