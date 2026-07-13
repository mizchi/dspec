import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: ".artifacts/playwright-report.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm serve:api",
      url: "http://127.0.0.1:8787/api/health",
      name: "api",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "pnpm serve:dashboard",
      url: "http://127.0.0.1:4173",
      name: "dashboard",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
