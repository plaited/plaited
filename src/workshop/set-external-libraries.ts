import { transpiler } from './workshop.utils'

export const setExternalLibraries = async ({
  cwd,
  files,
  externalLibraries,
}: {
  cwd: string
  files: string[]
  externalLibraries: Set<string>
}) =>
  Promise.allSettled(
    files.map(async (filePath) => {
      const absolutePath = Bun.resolveSync(`.${filePath}`, cwd)
      const file = Bun.file(absolutePath)
      const code = await file.text()
      transpiler.scanImports(code).map(({ path, kind }) => {
        if (externalLibraries.has(path)) return
        if (path.startsWith('.')) return
        if (['import-statement', 'dynamic-import'].includes(kind)) externalLibraries.add(kind)
      })
    }),
  )
