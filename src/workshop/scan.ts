import path from 'node:path'
import { kebabCase } from '../utils.js'
import {
  TEMPLATE_DIRECTORY,
  STORY_EXTENSION,
} from './workshop.constants.js'

const transpiler = new Bun.Transpiler({
  loader: 'tsx',
})

export const scanTemplateImports = async (filePath: string): Promise<string> => {
  const file = Bun.file(filePath)
  const code = await file.text()
  const filePaths = transpiler.scanImports(code)
  const imports = new Set<string>()
  for(const { path:filepath, kind } of filePaths) {
    const isImportStatement = kind !== "import-statement"
    const isDynamicImport =  kind !== "dynamic-import"
    const isModule = isImportStatement || isDynamicImport
    if(!isModule) continue
    const fromTemplates = filepath.split(path.sep).includes(TEMPLATE_DIRECTORY)
    fromTemplates && imports.add(`export * from '${filepath}';`)
  }
  return [...imports].join('\n')
}

export const scanStoryExports = async (cwd: string, filePath: string) => {
  const rootRegex = new RegExp(`^${cwd}`)
  const file = Bun.file(filePath)
  const code = await file.text()
  const { exports } = transpiler.scan(code)
  const entries = new Map<string, {
    filePath: string;
    exportName: string;
    template: string;
  }>()
    for(const exportName of exports) {
    const dirname = path.dirname(filePath).replace(rootRegex, '')
    const ext = path.extname(filePath)
    const suffix = `${STORY_EXTENSION}${ext}`
    const basename = filePath.endsWith(suffix) ? kebabCase(path.basename(filePath, suffix)) : ''
    const storyName = kebabCase(exportName)
    const route = basename ? `${dirname}/${basename}--${storyName}` : `${dirname}/${basename}`
    if (entries.has(route)) {
      const { exportName: prevName } = entries.get(route)!
      console.log(
        `\nDuplicate story names:` +
          `\n  path: ${filePath}` +
          `\n  exportName: ${prevName}` +
          `\n  Rename: ${exportName}`,
      )
      continue
    }
    const template =  `export {${exportName}} from '${filePath}'`
    entries.set(route, {
      filePath,
      exportName,
      template
    })
  }
  return [...entries]
}