import { esbuildPlugin } from '@web/dev-server-esbuild'
import { playwrightLauncher } from '@web/test-runner-playwright'
import { getFramework } from './dist/framework.js'
import { fileURLToPath } from 'url'

export default {
  files: 'src/**/*.spec.(ts|tsx)',
  nodeResolve: true,
  plugins: [
    esbuildPlugin({
      ts: true,
      tsx: true,
      tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
    }),
  ],
  port: 9002,
  testFramework: getFramework(3_000),
  browsers: [playwrightLauncher({ product: 'chromium' })],
}
