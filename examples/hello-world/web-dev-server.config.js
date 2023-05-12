import { esbuildPlugin } from '@web/dev-server-esbuild'
import { fileURLToPath } from 'url'

export default {
  nodeResolve: true,
  plugins: [ esbuildPlugin({
    ts: true,
    tsx: true,
    tsconfig: fileURLToPath(new URL('./tsconfig.json', import.meta.url)),
  }) ],
  appIndex: 'src/index.html',
  watch: true,
  open: true,
  rootDir: '../../',
}
