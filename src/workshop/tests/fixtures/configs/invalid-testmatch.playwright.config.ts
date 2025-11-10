import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/workshop/tests/fixtures/templates',
  // testMatch is RegExp instead of string - should cause validation error
  testMatch: /\.tpl\.spec\.(ts|tsx)$/,
  webServer: {
    url: 'http://localhost:3456',
    command: 'bun --hot src/workshop/cli.ts server',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:3456',
  },
})
