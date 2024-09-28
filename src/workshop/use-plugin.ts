import type { BunPlugin } from 'bun'
import path from 'node:path'
import { TEMPLATE_FILTER_REGEX, SERVER_TEMPLATE_NAMESPACE, TEMPLATE_DIRECTORY } from './workshop.constants.js'

const transpiler = new Bun.Transpiler({
  loader: 'tsx',
})

const scanTemplate = async (cwd: string, filePath: string): Promise<string> => {
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
  return content
}

export const usePlugin = (root: string): BunPlugin => ({
  name: 'workshop-plugin',
  setup({ onResolve, onLoad }) {
    onResolve(
      {
        filter: /\/template.tsx?$/,
        namespace: 'entry-point',
      },
      ({ path, namespace, ...rest }) => {
        return TEMPLATE_FILTER_REGEX.test(path) ?
            { path, namespace: SERVER_TEMPLATE_NAMESPACE, ...rest }
          : { path, namespace, ...rest }
      },
    )
    onLoad(
      {
        filter: /\.*/,
        namespace: SERVER_TEMPLATE_NAMESPACE,
      },
      async ({ path }) => {
        const [, contents] = await scanTemplate(root, path)
        return { contents, loader: 'tsx' }
      },
    )
  },
})
