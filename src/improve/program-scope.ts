import { dirname, relative, resolve } from 'node:path'
import { extractLocalLinksFromMarkdown, extractMarkdownSection } from '../utils.ts'

const normalizePath = (value: string): string => value.replaceAll('\\', '/')

const ensureDirectorySuffix = (path: string, originalLink: string): string =>
  originalLink.endsWith('/') && !path.endsWith('/') ? `${path}/` : path

export const parseProgramScope = async ({
  programMarkdown,
  programPath,
  workspaceRoot,
}: {
  programMarkdown: string
  programPath: string
  workspaceRoot: string
}): Promise<string[]> => {
  const section = extractMarkdownSection(programMarkdown, ['Scope', 'Writable Roots'])
  if (!section) return []

  const programDir = dirname(programPath)
  const links = await extractLocalLinksFromMarkdown(section)

  return links
    .map((link) => {
      const absolutePath = resolve(programDir, link)
      const relativePath = normalizePath(relative(workspaceRoot, absolutePath))
      return ensureDirectorySuffix(relativePath, link)
    })
    .filter((path) => path !== '' && path !== '.' && !path.startsWith('../'))
}
