import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Plaited component and template testing.
 * Uses a custom test server that dynamically renders templates based on HTTP requests.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './src',
  testMatch: '**/*.tpl.spec.ts',

  // Maximum time one test can run
  timeout: 30_000,

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: process.env.CI ? 'github' : 'list',

  // Shared settings for all projects
  use: {
    // Base URL for template server
    baseURL: 'http://localhost:3456',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run custom test server before starting the tests
  webServer: {
    command: 'bun --hot plaited server',
    url: 'http://localhost:3456',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
