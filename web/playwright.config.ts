import { defineConfig, devices } from "@playwright/test";

// Locally: `PW_CHANNEL=msedge pnpm --filter web e2e` reuses Edge (no browser download). CI installs Chromium.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4175",
    ...devices["iPhone 12"],
    // The app is designed for a 390 px phone screen.
    viewport: { width: 390, height: 844 },
    // Phone-shaped, but run in Chromium (Edge locally, Chromium in CI).
    defaultBrowserType: "chromium",
    channel: process.env.PW_CHANNEL || undefined,
    serviceWorkers: "block",
  },
  webServer: {
    command: "pnpm dev --port 4175 --strictPort",
    url: "http://localhost:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
