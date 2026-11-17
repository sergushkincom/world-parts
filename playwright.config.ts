import { defineConfig, devices } from "@playwright/test"

const port = Number(process.env.PORT ?? 3000)
const baseURL = `http://127.0.0.1:${port}`

/**
 * E2e against a local Next server. CI builds first, then starts `pnpm start`.
 * Locally, reuse an already-running server when present.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    ...devices["Desktop Chrome"],
    headless: true,
    trace: "on-first-retry",
    // Still-frame room view is enough; Live 3D / WebGL must not be required.
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: process.env.CI ? "pnpm start" : "pnpm exec next start",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
