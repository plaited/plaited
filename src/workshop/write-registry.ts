import * as esbuild from '../deps.ts'
import { registry, assetsDir } from '../utils/index.ts'

export const writeRegistry = async (
  fixtures: {
    name: string,
    path: string
  }[],
  assets: string
) => await esbuild.build({
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
