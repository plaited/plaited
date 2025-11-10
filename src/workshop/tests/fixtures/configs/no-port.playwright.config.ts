import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/workshop/tests/fixtures/templates',
  testMatch: '**/*.tpl.spec.{ts,tsx}',
  webServer: {
    // URL without explicit port - should cause validation error
    url: 'http://localhost',
    command: 'bun --hot src/workshop/cli.ts server',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost',
  },
})
