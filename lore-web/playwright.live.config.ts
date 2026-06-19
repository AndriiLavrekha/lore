import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /live-auth-matrix\.spec\.ts/,
  timeout: 180_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  use: {
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
