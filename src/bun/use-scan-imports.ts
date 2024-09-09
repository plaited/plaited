import { dirname, sep, resolve } from 'node:path'
import { TEMPLATES_DIR } from './bun.constants.js'

export const useScanImports = (dir: string = TEMPLATES_DIR) => {
  const transpiler = new Bun.Transpiler({
    loader: 'tsx',
  })
  return (filePath: string) => {
    const importPaths = transpiler
      .scanImports(filePath)
      .flatMap(({ path }) => (path.split(sep).includes(dir) ? [resolve(dirname(filePath), path)] : []))
    return importPaths
  }
}
