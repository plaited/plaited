import { exports, name } from '../package.json' with { type: 'json' }

const _plaited = '_plaited'

export const getLibrary = async () => {
  const libraryImportMap: Record<string, string> = {}
  for (const [key, value] of Object.entries(exports)) {
    const formattedKey = key.replace(/^\./, name)
    const formattedValue = value.replace(/^\.\/src/, `/${_plaited}`)
    libraryImportMap[formattedKey] = formattedValue.replace(/\.ts$/, '.js')
  }
  const { outputs: libraryArtifacts } = await Bun.build({
    entrypoints: Object.keys(libraryImportMap).map((key) => Bun.resolveSync(key, process.cwd())),
    splitting: true,
    naming: `${_plaited}/[name].[ext]`,
    sourcemap: 'inline',
  })
  return {
    libraryArtifacts,
    libraryImportMap,
  }
}
