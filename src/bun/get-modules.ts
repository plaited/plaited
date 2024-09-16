import { GLOB_PATTERN_MODULES } from './bun.constants.js'
import { isPlaitedTemplate } from './is-plaited-template.js'

const transpiler = new Bun.Transpiler({
  loader: 'tsx',
})

const registry = new Map<string, { filePath: string; exportName: string }>()

const getImports = async (templatePaths: { path: string; kind: string }[]) => {
  const imports = new Set<string>()
  await Promise.all(
    templatePaths.map(async ({ path: filePath }) => {
      try {
        const modules = await import(filePath)
        for (const exportName of modules) {
          const mod = modules[exportName]
          if (!mod || !isPlaitedTemplate(mod)) continue
          if (registry.has(mod.tag)) {
            console.error(
              `Error ${mod.tag} is already registered ${registry.get(mod.tag)?.exportName}@${registry.get(mod.tag)}\n Change tag name of ${exportName}@${filePath}`,
            )
            return
          } else {
            registry.set(mod.tag, { filePath, exportName })
            imports.add(filePath)
          }
        }
      } catch (err) {
        console.error(err)
      }
    }),
  )
  return imports
}

export const getModules = async (dir: string) => {
  const glob = new Bun.Glob(GLOB_PATTERN_MODULES)
  const storyPaths = await Array.fromAsync(glob.scan({ cwd: dir }))
  registry.clear()
  const entries = await Promise.all(
    storyPaths.map(async (filePath) => {
      try {
        const file = Bun.file(filePath)
        const code = await file.text()
        const result = transpiler.scanImports(code)
        const imports = await getImports(result)
        let fileImports = ''
        for (const entry of imports) {
          fileImports += `import '${entry}'\n`
        }
        const regex = /\.tsx?$/
        return { [filePath.replace(regex, '.plaited')]: fileImports }
      } catch (err) {
        console.error(err)
      }
    }),
  )
  return entries
}
