import { dirname, sep, resolve } from 'node:path'
import { COMPONENT_DIR } from './constants.js'

export const useScanImports = (dir: string = COMPONENT_DIR) => {
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
