import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './src/workshop/tests',
  testMatch: '**/*.playwright.ts', // Custom extension to avoid clash with bun test
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3456',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'bun run dev',
    url: 'http://localhost:3456',
    reuseExistingServer: !process.env.CI,
  },
})
