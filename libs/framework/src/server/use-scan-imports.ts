import { dirname, sep, resolve } from 'node:path'

export const useScanImports = (dir: string = '_components') => {
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
