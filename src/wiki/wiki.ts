import { basename, dirname, extname, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import { makeCli } from '../cli/cli.ts'
import { extractLocalLinksFromMarkdown } from '../cli/markdown.ts'
import { type WikiCliInput, WikiCliInputSchema, type WikiCliOutput, WikiCliOutputSchema } from './wiki.schemas.ts'

export const WIKI_COMMAND = 'wiki'

const DEFAULT_IGNORE_GLOBS = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/tmp/**',
  '**/temp/**',
]

const TYPESCRIPT_LSP_SKILL_RUNNER = 'skills/typescript-lsp/scripts/run.ts'
const TYPESCRIPT_LSP_SCAN_FILE_GLOBS = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']
const TYPESCRIPT_TEST_FILE_PATTERN = /(^|\/)(tests?\/|.*\.(spec|test)\.[jt]sx?$)/

const toPosixPath = (value: string): string => value.replace(/\\/g, '/')
const isMarkdownPath = (value: string): boolean => value.toLowerCase().endsWith('.md')
const isTypeScriptLspTargetPath = (value: string): boolean => /\.(?:ts|tsx|js|jsx)$/i.test(value)
const isTypeScriptTestPath = (value: string): boolean => TYPESCRIPT_TEST_FILE_PATTERN.test(value)
const quoteShellArg = (value: string): string => {
  const escaped = value.replaceAll("'", `'"'"'`)
  return `'${escaped}'`
}

const isInsideRootDir = ({ rootDir, targetPath }: { rootDir: string; targetPath: string }): boolean => {
  const relativePath = toPosixPath(relative(rootDir, targetPath))
  if (relativePath.length === 0) return true
  if (relativePath === '..') return false
  return !relativePath.startsWith('../')
}

const normalizeRelativePath = ({ rootDir, absolutePath }: { rootDir: string; absolutePath: string }): string => {
  return toPosixPath(relative(rootDir, absolutePath))
}

const createGlobMatchers = (patterns: string[]): Glob[] => patterns.map((pattern) => new Glob(pattern))

const matchesAnyGlob = ({ path, globs }: { path: string; globs: Glob[] }): boolean => {
  for (const glob of globs) {
    if (glob.match(path)) {
      return true
    }
  }

  return false
}

const shouldExcludePath = ({
  path,
  defaultIgnoreMatchers,
  userIgnoreMatchers,
}: {
  path: string
  defaultIgnoreMatchers: Glob[]
  userIgnoreMatchers: Glob[]
}): boolean => {
  if (basename(path) === 'AGENTS.md') return true
  if (path.startsWith('skills/')) return true
  if (matchesAnyGlob({ path, globs: defaultIgnoreMatchers })) return true
  if (matchesAnyGlob({ path, globs: userIgnoreMatchers })) return true
  return false
}

const collectMarkdownPaths = async ({
  rootDir,
  paths,
  ignore,
}: {
  rootDir: string
  paths: string[]
  ignore: string[]
}): Promise<string[]> => {
  const discoveredPaths = new Set<string>()
  const defaultIgnoreMatchers = createGlobMatchers(DEFAULT_IGNORE_GLOBS)
  const userIgnoreMatchers = createGlobMatchers(ignore)

  for (const inputPath of paths) {
    const absoluteInputPath = resolve(rootDir, inputPath)
    if (!isInsideRootDir({ rootDir, targetPath: absoluteInputPath })) {
      throw new Error(`Input path must stay within rootDir: ${inputPath}`)
    }

    const markdownFile = Bun.file(absoluteInputPath)

    if (await markdownFile.exists()) {
      const relativePath = normalizeRelativePath({
        rootDir,
        absolutePath: absoluteInputPath,
      })
      if (!isMarkdownPath(relativePath)) {
        continue
      }
      if (
        !shouldExcludePath({
          path: relativePath,
          defaultIgnoreMatchers,
          userIgnoreMatchers,
        })
      ) {
        discoveredPaths.add(relativePath)
      }
      continue
    }

    try {
      for await (const absoluteMatch of new Glob('**/*.md').scan({
        cwd: absoluteInputPath,
        absolute: true,
        dot: true,
      })) {
        const relativePath = normalizeRelativePath({
          rootDir,
          absolutePath: absoluteMatch,
        })
        if (
          shouldExcludePath({
            path: relativePath,
            defaultIgnoreMatchers,
            userIgnoreMatchers,
          })
        ) {
          continue
        }

        discoveredPaths.add(relativePath)
      }
    } catch {}
  }

  return [...discoveredPaths].sort((left, right) => left.localeCompare(right))
}

const extractHeadings = (markdown: string): string[] => {
  const headings: string[] = []

  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^#{1,6}\s+(.+)$/)
    if (!match) continue
    const heading = match[1]?.trim()
    if (!heading) continue
    headings.push(heading)
  }

  return headings
}

const toTitle = ({ markdownPath, headings }: { markdownPath: string; headings: string[] }): string => {
  const heading = headings[0]
  if (heading) return heading
  const fileName = basename(markdownPath)
  return fileName.slice(0, fileName.length - extname(fileName).length)
}

const tokenize = (value: string): string[] => {
  const terms = value.toLowerCase().match(/[a-z0-9]+/g) ?? []
  return [...new Set(terms.filter((term) => term.length > 1))]
}

type PageReferenceScanResult = {
  outboundLocalReferences: string[]
  warnings: WikiCliOutput['warnings']
}

const scanPageReferences = async ({
  rootDir,
  markdownPath,
  markdown,
}: {
  rootDir: string
  markdownPath: string
  markdown: string
}): Promise<PageReferenceScanResult> => {
  const absolutePagePath = resolve(rootDir, markdownPath)
  const outboundLocalReferences = new Set<string>()
  const warnings = new Map<string, WikiCliOutput['warnings'][number]>()
  const localLinks = await extractLocalLinksFromMarkdown(markdown)

  for (const link of localLinks) {
    const absoluteTargetPath = resolve(dirname(absolutePagePath), link.value)

    if (!isInsideRootDir({ rootDir, targetPath: absoluteTargetPath })) {
      const warning = {
        kind: 'broken-local-link' as const,
        path: markdownPath,
        linkValue: link.value,
        targetPath: null,
        message: `Local link '${link.value}' cannot be resolved to a workspace path.`,
      }
      warnings.set(`${warning.kind}\u0000${warning.path}\u0000${link.value}`, warning)
      continue
    }

    const targetPath = normalizeRelativePath({
      rootDir,
      absolutePath: absoluteTargetPath,
    })
    const targetFile = Bun.file(absoluteTargetPath)

    if (await targetFile.exists()) {
      outboundLocalReferences.add(targetPath)
      continue
    }

    const retiredSkillReference = targetPath.startsWith('skills/') && targetPath.endsWith('/SKILL.md')
    const warningKind: WikiCliOutput['warnings'][number]['kind'] = retiredSkillReference
      ? 'retired-skill-reference'
      : 'missing-target-file'
    const warning = {
      kind: warningKind,
      path: markdownPath,
      linkValue: link.value,
      targetPath,
      message: retiredSkillReference
        ? `Link target '${targetPath}' points to a missing skill reference.`
        : `Link target '${targetPath}' does not exist in the workspace.`,
    }
    warnings.set(`${warning.kind}\u0000${warning.path}\u0000${link.value}`, warning)
  }

  return {
    outboundLocalReferences: [...outboundLocalReferences].sort((left, right) => left.localeCompare(right)),
    warnings: [...warnings.values()].sort((left, right) => {
      const leftKey = `${left.path}\u0000${left.kind}\u0000${left.linkValue ?? ''}`
      const rightKey = `${right.path}\u0000${right.kind}\u0000${right.linkValue ?? ''}`
      return leftKey.localeCompare(rightKey)
    }),
  }
}

type WikiPageAnalysis = {
  path: string
  title: string
  headings: string[]
  markdown: string
  outboundLocalReferences: string[]
}

const buildWikiPageAnalyses = async ({
  rootDir,
  markdownPaths,
}: {
  rootDir: string
  markdownPaths: string[]
}): Promise<{ pages: WikiPageAnalysis[]; warnings: WikiCliOutput['warnings'] }> => {
  const pages: WikiPageAnalysis[] = []
  const warnings: WikiCliOutput['warnings'] = []

  for (const markdownPath of markdownPaths) {
    const absolutePath = resolve(rootDir, markdownPath)
    const markdown = await Bun.file(absolutePath).text()
    const headings = extractHeadings(markdown)
    const pageReferences = await scanPageReferences({
      rootDir,
      markdownPath,
      markdown,
    })

    pages.push({
      path: markdownPath,
      title: toTitle({ markdownPath, headings }),
      headings,
      markdown,
      outboundLocalReferences: pageReferences.outboundLocalReferences,
    })
    warnings.push(...pageReferences.warnings)
  }

  return {
    pages,
    warnings,
  }
}

const appendOrphanWarnings = ({
  pages,
  warnings,
}: {
  pages: WikiPageAnalysis[]
  warnings: WikiCliOutput['warnings']
}): WikiCliOutput['warnings'] => {
  const pagePathSet = new Set(pages.map((page) => page.path))
  const inboundCounts = new Map<string, number>()

  for (const page of pages) {
    for (const reference of page.outboundLocalReferences) {
      if (!pagePathSet.has(reference)) continue
      inboundCounts.set(reference, (inboundCounts.get(reference) ?? 0) + 1)
    }
  }

  const warningMap = new Map<string, WikiCliOutput['warnings'][number]>()
  for (const warning of warnings) {
    warningMap.set(`${warning.path}\u0000${warning.kind}\u0000${warning.linkValue ?? ''}`, warning)
  }

  for (const page of pages) {
    const outboundCount = page.outboundLocalReferences.filter((reference) => pagePathSet.has(reference)).length
    const inboundCount = inboundCounts.get(page.path) ?? 0

    if (outboundCount > 0 || inboundCount > 0) continue

    const warning = {
      kind: 'orphan-page' as const,
      path: page.path,
      message: 'Wiki page has no inbound or outbound local wiki references.',
    }
    warningMap.set(`${warning.path}\u0000${warning.kind}\u0000`, warning)
  }

  return [...warningMap.values()].sort((left, right) => {
    const leftKey = `${left.path}\u0000${left.kind}\u0000${left.linkValue ?? ''}`
    const rightKey = `${right.path}\u0000${right.kind}\u0000${right.linkValue ?? ''}`
    return leftKey.localeCompare(rightKey)
  })
}

type RankedPage = {
  page: WikiPageAnalysis
  score: number
  matchedTerms: string[]
  matchedFields: string[]
}

const rankPagesForTask = ({ pages, task }: { pages: WikiPageAnalysis[]; task: string }): RankedPage[] => {
  const terms = tokenize(task)

  return pages
    .map((page) => {
      const matchedTerms = new Set<string>()
      const matchedFields = new Set<string>()
      let score = 0

      for (const term of terms) {
        const inPath = page.path.toLowerCase().includes(term)
        const inTitle = page.title.toLowerCase().includes(term)
        const inHeading = page.headings.some((heading) => heading.toLowerCase().includes(term))
        const inBody = page.markdown.toLowerCase().includes(term)
        const inLinks = page.outboundLocalReferences.some((reference) => reference.toLowerCase().includes(term))

        if (inPath || inTitle || inHeading || inBody || inLinks) {
          matchedTerms.add(term)
        }
        if (inPath) {
          score += 6
          matchedFields.add('path')
        }
        if (inTitle) {
          score += 5
          matchedFields.add('title')
        }
        if (inHeading) {
          score += 4
          matchedFields.add('heading')
        }
        if (inBody) {
          score += 2
          matchedFields.add('body')
        }
        if (inLinks) {
          score += 1
          matchedFields.add('outbound-link')
        }
      }

      return {
        page,
        score,
        matchedTerms: [...matchedTerms].sort((left, right) => left.localeCompare(right)),
        matchedFields: [...matchedFields].sort((left, right) => left.localeCompare(right)),
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      return left.page.path.localeCompare(right.page.path)
    })
}

const toPageReason = ({
  mode,
  matchedTerms,
  matchedFields,
}: {
  mode: WikiCliInput['mode']
  matchedTerms: string[]
  matchedFields: string[]
}): string => {
  if (mode === 'diagnose') {
    return 'Included from supplied wiki paths for diagnostics.'
  }

  if (matchedTerms.length === 0) {
    return 'No direct task-term matches; included from supplied wiki paths.'
  }

  const fieldsText = matchedFields.length > 0 ? matchedFields.join(', ') : 'page content'
  return `Matched task terms (${matchedTerms.join(', ')}) in ${fieldsText}.`
}

const collectTypescriptLspSuggestionFiles = async ({
  rootDir,
  paths,
  ignore,
}: {
  rootDir: string
  paths: string[]
  ignore: string[]
}): Promise<string[]> => {
  const discoveredPaths = new Set<string>()
  const defaultIgnoreMatchers = createGlobMatchers(DEFAULT_IGNORE_GLOBS)
  const userIgnoreMatchers = createGlobMatchers(ignore)

  for (const inputPath of paths) {
    const absoluteInputPath = resolve(rootDir, inputPath)
    if (!isInsideRootDir({ rootDir, targetPath: absoluteInputPath })) continue

    const targetFile = Bun.file(absoluteInputPath)
    if (await targetFile.exists()) {
      const relativePath = normalizeRelativePath({
        rootDir,
        absolutePath: absoluteInputPath,
      })
      if (!isTypeScriptLspTargetPath(relativePath)) continue
      if (
        shouldExcludePath({
          path: relativePath,
          defaultIgnoreMatchers,
          userIgnoreMatchers,
        })
      ) {
        continue
      }
      discoveredPaths.add(relativePath)
      continue
    }

    try {
      for (const pattern of TYPESCRIPT_LSP_SCAN_FILE_GLOBS) {
        for await (const absoluteMatch of new Glob(pattern).scan({
          cwd: absoluteInputPath,
          absolute: true,
          dot: true,
        })) {
          const relativePath = normalizeRelativePath({
            rootDir,
            absolutePath: absoluteMatch,
          })
          if (
            shouldExcludePath({
              path: relativePath,
              defaultIgnoreMatchers,
              userIgnoreMatchers,
            })
          ) {
            continue
          }
          discoveredPaths.add(relativePath)
        }
      }
    } catch {}
  }

  return [...discoveredPaths].sort((left, right) => left.localeCompare(right))
}

const buildSuggestedNextCommands = async ({
  rootDir,
  paths,
  ignore,
}: {
  rootDir: string
  paths: string[]
  ignore: string[]
}): Promise<string[]> => {
  const firstPath = paths[0] ?? 'docs'
  const suggestedCommands = [`git log --oneline -20 -- ${quoteShellArg(firstPath)}`]

  const lspTargetFiles = await collectTypescriptLspSuggestionFiles({
    rootDir,
    paths,
    ignore,
  })
  const firstLspTargetFile = lspTargetFiles.find((candidatePath) => !isTypeScriptTestPath(candidatePath))
  const fallbackLspTargetFile = lspTargetFiles[0]
  const selectedLspTargetFile = firstLspTargetFile ?? fallbackLspTargetFile
  if (selectedLspTargetFile) {
    const workspaceScanPayload = JSON.stringify({
      file: selectedLspTargetFile,
      files: [selectedLspTargetFile],
      operations: [{ type: 'workspace_scan' }],
    })
    suggestedCommands.push(`bun ${TYPESCRIPT_LSP_SKILL_RUNNER} ${quoteShellArg(workspaceScanPayload)}`)
  }

  suggestedCommands.push(`bun ./bin/plaited.ts skills '{"mode":"catalog","rootDir":"."}'`)
  return suggestedCommands
}

const runWiki = async (input: WikiCliInput): Promise<WikiCliOutput> => {
  const rootDir = resolve(input.rootDir)
  const markdownPaths = await collectMarkdownPaths({
    rootDir,
    paths: input.paths,
    ignore: input.ignore,
  })
  const analysis = await buildWikiPageAnalyses({
    rootDir,
    markdownPaths,
  })
  const warnings = appendOrphanWarnings({
    pages: analysis.pages,
    warnings: analysis.warnings,
  })

  const rankedPages =
    input.mode === 'context'
      ? rankPagesForTask({
          pages: analysis.pages,
          task: input.task,
        })
      : analysis.pages
          .map((page) => ({
            page,
            score: 0,
            matchedTerms: [],
            matchedFields: [],
          }))
          .sort((left, right) => left.page.path.localeCompare(right.page.path))

  return {
    mode: input.mode,
    pages: rankedPages.map((entry) => ({
      path: entry.page.path,
      title: entry.page.title,
      headings: entry.page.headings,
      outboundLocalReferences: entry.page.outboundLocalReferences,
      matchedTerms: entry.matchedTerms,
      reason: toPageReason({
        mode: input.mode,
        matchedTerms: entry.matchedTerms,
        matchedFields: entry.matchedFields,
      }),
    })),
    warnings,
    suggestedNextCommands: await buildSuggestedNextCommands({
      rootDir,
      paths: input.paths,
      ignore: input.ignore,
    }),
  }
}

export const wikiCli = makeCli({
  name: WIKI_COMMAND,
  inputSchema: WikiCliInputSchema,
  outputSchema: WikiCliOutputSchema,
  run: runWiki,
})
