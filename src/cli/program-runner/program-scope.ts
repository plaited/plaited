import { dirname, relative, resolve } from 'node:path'
import { extractLocalLinksFromMarkdown, extractMarkdownSection } from '../utils/markdown.ts'

const normalizePath = (value: string): string => value.replaceAll('\\', '/')
const FACTORY_LANE_SCOPE = ['src/factories/', 'src/factories.ts']
const FACTORY_LANE_PATTERN = /^dev-research\/(?:default-factories|server-factory|[a-z0-9-]*factories)\/program\.md$/

const ensureDirectorySuffix = (path: string, originalLink: string): string =>
  originalLink.endsWith('/') && !path.endsWith('/') ? `${path}/` : path

const getFactoryLaneFallbackScope = ({
  programPath,
  workspaceRoot,
}: {
  programPath: string
  workspaceRoot: string
}): string[] => {
  const relativeProgramPath = normalizePath(relative(workspaceRoot, programPath))
  return FACTORY_LANE_PATTERN.test(relativeProgramPath) ? FACTORY_LANE_SCOPE : []
}

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
  if (!section) {
    return getFactoryLaneFallbackScope({
      programPath,
      workspaceRoot,
    })
  }

  const programDir = dirname(programPath)
  const links = await extractLocalLinksFromMarkdown(section)

  const scopedPaths = links
    .map((link) => {
      const absolutePath = resolve(programDir, link)
      const relativePath = normalizePath(relative(workspaceRoot, absolutePath))
      return ensureDirectorySuffix(relativePath, link)
    })
    .filter((path) => path !== '' && path !== '.' && !path.startsWith('../'))

  if (scopedPaths.length > 0) {
    return scopedPaths
  }

  return getFactoryLaneFallbackScope({
    programPath,
    workspaceRoot,
  })
}
