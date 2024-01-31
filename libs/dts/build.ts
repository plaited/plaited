import { dts } from './src/index.js'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  minify: true,
  plugins: [dts()],
  target: 'node',
  format: 'esm',
  external: ['dts-bundle-generator', 'get-tsconfig'],
})
