import * as esbuild from 'esbuild'
import { worksDir } from '../utils/index.js'

export const writeWorks = async (works: string[]) => {
  /** bundle works */
  const result = await esbuild.build({
    entryPoints: works,
    bundle: true,
    target: [
      'es2020',
    ],
    outdir: worksDir,
  })
  
  /** return works paths */
  return (result.outputFiles as esbuild.OutputFile[]).map(obj => obj.path)
}
