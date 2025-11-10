import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './src/workshop/tests/fixtures/templates',
  testMatch: '**/*.tpl.spec.{ts,tsx}',
  // webServer is missing - should cause validation error
  use: {
    baseURL: 'http://localhost:3456',
  },
})
