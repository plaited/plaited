import { esbuildPlugin } from '@web/dev-server-esbuild'
import { getFramework } from '@plaited/rite/framework'
import { fileURLToPath } from 'url'

export default {
  plugins: [ esbuildPlugin({
    ts: true,
    tsx: true,
    tsconfig: fileURLToPath(new URL('./tsconfig.test.json', import.meta.url)),
  }) ],
  port: 8080,
  testFramework: getFramework(3_000),
}
