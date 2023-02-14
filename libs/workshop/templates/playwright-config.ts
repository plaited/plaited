import { relative } from '../../deps.ts'
export const playwrightConfig = ({
  port,
  protocol,
  playwright,
}: {
  port: number
  protocol: 'http' | 'https'
  playwright: string
}) =>
  `import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'cd ${relative(playwright, Deno.cwd())} && deno task start',
    url: '${protocol}://localhost:${port}/',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: '${protocol}://localhost:${port}/',
  },
});`
