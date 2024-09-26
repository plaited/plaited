import path from 'node:path'
import { kebabCase } from '../utils/case.js'
import { TEMPLATE_DIRECTORY, STORIES_FILTERS_REGEX } from './workshop.constants.js'

export const transpiler = new Bun.Transpiler({
  loader: 'tsx',
})


export const scanTemplate = async (cwd: string, filePath: string): Promise<[string, string]> => {
  const absolutePath = Bun.resolveSync(`./${filePath}`, cwd)
  const file = Bun.file(absolutePath)
  const code = await file.text()
  const filePaths = transpiler.scanImports(code)
  const imports = new Set<string>()
  for (const { path: filepath, kind } of filePaths) {
    const isImportStatement = kind !== 'import-statement'
    const isDynamicImport = kind !== 'dynamic-import'
    const isModule = isImportStatement || isDynamicImport
    if (!isModule) continue
    const fromTemplates = filepath.split(path.sep).includes(TEMPLATE_DIRECTORY)
    fromTemplates && imports.add(`export * from '${absolutePath}';`)
  }
  const content = [...imports].join('\n')
  return [`${filePath}`, content]
}

export const scanStories = async ({
  cwd,
  filePath,
  tmp,
}:{
  cwd: string,
  filePath: string,
  tmp: string
}) => {
  const absolutePath = Bun.resolveSync(`./${filePath}`, cwd)
  const file = Bun.file(absolutePath)
  const code = await file.text()
  const { exports } = transpiler.scan(code)
  const entires = new Map<string, string>()
  for (const exportName of exports) {
    const dirname = path.dirname(filePath).toLowerCase()
    const basename =
      STORIES_FILTERS_REGEX.test(filePath) ? kebabCase(path.basename(filePath.replace(STORIES_FILTERS_REGEX, ''))) : ''
    const storyName = kebabCase(exportName)
    const id = basename ? `${basename}--${storyName}` : basename
    const route = `${dirname}/${id}.ts`
    if (entires.has(route)) {
      console.log(
        `\nDuplicate story names:` +
          `\n  path: ${filePath}` +
          `\n  exportName: ${exportName}` +
          `\n  id: ${id}`,
      )
      continue
    }
    const template = `export {${exportName}} from '${absolutePath}';`
    const entryPath = `${tmp}/${route}`
    await Bun.write(entryPath, template)
    entires.set(route, template)
  }
  return [...entires]
}
