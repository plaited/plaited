import { dirname, relative, resolve } from 'node:path'
import { extractLocalLinksFromMarkdown, extractMarkdownSection } from '../utils/markdown.ts'

const normalizePath = (value: string): string => value.replaceAll('\\', '/')

const ensureDirectorySuffix = (path: string, originalLink: string): string =>
  originalLink.endsWith('/') && !path.endsWith('/') ? `${path}/` : path

/**
 * Parses writable program scope entries from a program markdown document.
 *
 * @param options - Program markdown and path resolution inputs.
 * @param options.programMarkdown - Full program markdown source.
 * @param options.programPath - Absolute path to the program markdown file.
 * @param options.workspaceRoot - Absolute workspace root used to relativize links.
 * @returns Workspace-relative paths declared under the program scope section.
 *
 * @public
 */
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
