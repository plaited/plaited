import path from 'path'
import * as esbuild from 'esbuild'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

await esbuild.build({
  entryPoints: [ path.resolve(__dirname, '../src/islands/registry.ts') ],
  bundle: true,
  format: 'esm',
  minify: true,
  target: [
    'es2022',
    'chrome109',
  ],
  outdir: path.resolve(process.cwd(), './public'),
})

await esbuild.build({
  entryPoints: [ path.resolve(__dirname, '../src/index.ts') ],
  bundle: true,
  packages: 'external',
  format: 'esm',
  target: [
    'es2022',
    'node18',
  ],
  outdir: path.resolve(process.cwd(), './dist'),
})
