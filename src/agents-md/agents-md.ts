import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import { makeCli } from '../cli/cli.ts'
import { type LocalMarkdownLink, validateMarkdownLocalLinks } from '../cli/markdown.ts'
import { AGENTS_MD_COMMAND, AGENTS_MD_DEFAULT_IGNORE_GLOBS, AGENTS_MD_DISCOVERY_GLOB } from './agents-md.constants.ts'
import { AgentsMdCliInputSchema, type AgentsMdCliOutput, AgentsMdCliOutputSchema } from './agents-md.schemas.ts'

type AgentsMdEntry = {
  path: string
  scope: string
  body: string
  links: {
    present: LocalMarkdownLink[]
    missing: LocalMarkdownLink[]
  }
}

type AgentsMdWarning = {
  code: 'missing_local_link'
  path: string
  link: LocalMarkdownLink
  message: string
}

type DiscoveredAgentsMd = {
  path: string
  absolutePath: string
}

const normalizeRelativePath = (value: string): string => value.replace(/\\/g, '/')

const resolvePathWithinRoot = ({
  rootDir,
  inputPath,
}: {
  rootDir: string
  inputPath: string
}): { absolutePath: string; relativePath: string } => {
  const absoluteRootDir = resolve(rootDir)
  const absolutePath = isAbsolute(inputPath) ? resolve(inputPath) : resolve(absoluteRootDir, inputPath)
  const relation = normalizeRelativePath(relative(absoluteRootDir, absolutePath))

  if (relation === '' || (!relation.startsWith('../') && relation !== '..')) {
    return {
      absolutePath,
      relativePath: relation,
    }
  }

  throw new Error(`Path escapes rootDir: ${inputPath}`)
}

const toScope = (agentsPath: string): string => {
  if (agentsPath === 'AGENTS.md') return '.'
  return agentsPath.replace(/\/AGENTS\.md$/u, '')
}

const isIgnoredPath = ({ path, ignoreGlobs }: { path: string; ignoreGlobs: string[] }): boolean =>
  ignoreGlobs.some((globPattern) => new Glob(globPattern).match(path))

const discoverAgentsFiles = async ({
  rootDir,
  ignoreGlobs,
}: {
  rootDir: string
  ignoreGlobs: string[]
}): Promise<DiscoveredAgentsMd[]> => {
  const absoluteRootDir = resolve(rootDir)
  const discovered = new Map<string, DiscoveredAgentsMd>()

  const rootAgentsPath = resolve(absoluteRootDir, 'AGENTS.md')
  const rootAgentsFile = Bun.file(rootAgentsPath)
  if (await rootAgentsFile.exists()) {
    discovered.set('AGENTS.md', {
      path: 'AGENTS.md',
      absolutePath: rootAgentsPath,
    })
  }

  const agentsGlob = new Glob(AGENTS_MD_DISCOVERY_GLOB)
  for await (const file of agentsGlob.scan({ cwd: absoluteRootDir, absolute: true, dot: true })) {
    const relativePath = normalizeRelativePath(relative(absoluteRootDir, file))
    if (!relativePath || isIgnoredPath({ path: relativePath, ignoreGlobs })) continue

    discovered.set(relativePath, {
      path: relativePath,
      absolutePath: file,
    })
  }

  return [...discovered.values()].sort((left, right) => left.path.localeCompare(right.path))
}

const loadAgentsEntry = async ({
  agents,
}: {
  agents: DiscoveredAgentsMd
}): Promise<{ entry: AgentsMdEntry; warnings: AgentsMdWarning[] }> => {
  const agentsFile = Bun.file(agents.absolutePath)
  const body = await agentsFile.text()
  const links = await validateMarkdownLocalLinks({
    baseDir: dirname(agents.absolutePath),
    markdownBody: body,
  })

  const present = [...links.present]
  const missing = [...links.missing]

  const warnings: AgentsMdWarning[] = missing.map((link) => ({
    code: 'missing_local_link',
    path: agents.path,
    link,
    message: `Missing local markdown link: ${link.value}`,
  }))

  return {
    entry: {
      path: agents.path,
      scope: toScope(agents.path),
      body,
      links: {
        present,
        missing,
      },
    },
    warnings,
  }
}

const isRelevantScope = ({ scope, targetPath }: { scope: string; targetPath: string }): boolean => {
  if (scope === '.') return true
  const normalizedScope = scope.replace(/^\.\//u, '').replace(/\/$/u, '')
  const normalizedTargetPath = targetPath.replace(/^\.\//u, '').replace(/\/$/u, '')

  return normalizedTargetPath === normalizedScope || normalizedTargetPath.startsWith(`${normalizedScope}/`)
}

const getScopeDepth = (scope: string): number => {
  if (scope === '.') return 0
  return scope.split('/').filter((segment) => segment.length > 0).length
}

const sortRelevantEntries = (entries: AgentsMdEntry[]): AgentsMdEntry[] =>
  [...entries].sort((left, right) => {
    if (left.scope === '.' && right.scope !== '.') return -1
    if (left.scope !== '.' && right.scope === '.') return 1

    const depthComparison = getScopeDepth(left.scope) - getScopeDepth(right.scope)
    if (depthComparison !== 0) return depthComparison

    return left.path.localeCompare(right.path)
  })

const runAgentsMd = async (input: unknown): Promise<AgentsMdCliOutput> => {
  const parsed = AgentsMdCliInputSchema.parse(input)
  const rootDir = resolve(parsed.rootDir)
  const ignoreGlobs = [...AGENTS_MD_DEFAULT_IGNORE_GLOBS, ...parsed.ignoreGlobs]
  const discovered = await discoverAgentsFiles({ rootDir, ignoreGlobs })

  const loaded = await Promise.all(
    discovered.map(async (agents) => {
      const loadedEntry = await loadAgentsEntry({ agents })
      return loadedEntry
    }),
  )

  const allEntries = loaded.map((result) => result.entry)
  const allWarnings = loaded
    .flatMap((result) => result.warnings)
    .sort((left, right) => {
      const pathComparison = left.path.localeCompare(right.path)
      if (pathComparison !== 0) return pathComparison
      const valueComparison = left.link.value.localeCompare(right.link.value)
      if (valueComparison !== 0) return valueComparison
      return left.link.text.localeCompare(right.link.text)
    })

  if (parsed.mode === 'list') {
    return {
      mode: 'list',
      rootDir,
      entries: allEntries,
      warnings: allWarnings,
    }
  }

  const targetPaths = parsed.paths
    .map((path) => resolvePathWithinRoot({ rootDir, inputPath: path }).relativePath)
    .map((path) => (path === '' ? '.' : path))

  const entries = sortRelevantEntries(
    allEntries.filter((entry) =>
      entry.scope === '.'
        ? true
        : targetPaths.some((targetPath) =>
            isRelevantScope({
              scope: entry.scope,
              targetPath,
            }),
          ),
    ),
  )

  return {
    mode: 'relevant',
    rootDir,
    paths: targetPaths,
    entries,
    warnings: allWarnings.filter((warning) => entries.some((entry) => entry.path === warning.path)),
  }
}

/**
 * CLI handler for `agents-md`.
 *
 * @public
 */
export const agentsMdCli = makeCli({
  name: AGENTS_MD_COMMAND,
  inputSchema: AgentsMdCliInputSchema,
  outputSchema: AgentsMdCliOutputSchema,
  run: runAgentsMd,
})
