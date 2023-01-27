import * as esbuild from 'esbuild'
import { registry, assetsDir } from '../utils/index.js'

export const writeRegistry = async (fixtures: string[], resolveDir: string ) => await esbuild.build({
  stdin: {
    contents: fixtures.map((fixture: string) => `import './${fixture}'`).join('\n'),
    resolveDir,
    loader: 'ts',
  },
  format: 'esm',
  target: [
    'es2020',
  ],
  outfile: `${assetsDir}/${registry}`,
})
