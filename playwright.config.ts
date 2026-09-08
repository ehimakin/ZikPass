import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.ZIK_E2E_BASE_URL ?? "http://localhost:3000";

/**
 * End-to-end coverage for the customer, clerk and affiliate journeys.
 *
 * These run against a live dev server (reused if one is already on :3000).
 * They mutate runtime state, so every spec resets it via the demo-gated
 * /api/demo/reset endpoint - keep ZIK_ENV=demo for the target server.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    actionTimeout: 15_000
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000
  }
});
