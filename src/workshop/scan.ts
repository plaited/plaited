import path from 'node:path'
import { kebabCase } from '../utils/case.js'
import { TEMPLATE_DIRECTORY, STORIES_FILTERS_REGEX } from './workshop.constants.js'

const transpiler = new Bun.Transpiler({
  loader: 'tsx',
})

export const scanTemplateImports = async (cwd: string, filePath: string): Promise<string> => {
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
  return [...imports].join('\n')
}

export type StoriesMap = Map<
  string,
  {
    entryPath: string
    exportName: string
    template: string
    relativePath: string
  }
>

export const scanStoryExports = async ({
  cwd = process.cwd(),
  filePath,
  stories,
  tmp,
}: {
  cwd?: string
  filePath: string
  stories: StoriesMap
  tmp: string
}) => {
  const relativePath = `./${filePath}`
  const file = Bun.file(Bun.resolveSync(relativePath, cwd))
  const code = await file.text()
  const { exports } = transpiler.scan(code)
  for (const exportName of exports) {
    const dirname = path.dirname(filePath).toLowerCase()
    const basename =
      STORIES_FILTERS_REGEX.test(filePath) ? kebabCase(path.basename(filePath.replace(STORIES_FILTERS_REGEX, ''))) : ''
    const storyName = kebabCase(exportName)
    const route = basename ? `/${dirname}/${basename}--${storyName}` : `${dirname}/${basename}`
    if (stories.has(route)) {
      const { exportName: prevName } = stories.get(route)!
      console.log(
        `\nDuplicate story names:` +
          `\n  path: ${filePath}` +
          `\n  exportName: ${prevName}` +
          `\n  Rename: ${exportName}`,
      )
      continue
    }
    const template = `export {${exportName}} from '${Bun.resolveSync(relativePath, cwd)}';`
    const entryPath = `${tmp}/${route}.js`
    Bun.write(entryPath, template)
    stories.set(route, {
      entryPath,
      exportName,
      template,
      relativePath,
    })
  }
}
