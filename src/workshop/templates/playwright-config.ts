export const playwrightConfig = (port: number, protocol: 'http' | 'https') => `import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'deno task start',
    url: '${protocol}://localhost:${port}/',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: '${protocol}://localhost:${port}/',
  },
});`