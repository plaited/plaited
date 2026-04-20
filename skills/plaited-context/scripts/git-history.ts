import { resolve } from 'node:path'
import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  buildStructuredCliError,
  collectChangedFiles,
  collectCommits,
  collectPathHistory,
  GitChangedFileSchema,
  GitCommitSchema,
  GitPathHistoryEntrySchema,
  resolveGitRef,
  resolveGitRepoRoot,
  resolveMergeBase,
  resolvePathListWithinRepo,
} from './git-context.shared.ts'

const DEFAULT_LIMIT = 20
const MAX_CHANGED_FILES = 200
const BROAD_CHANGED_FILE_THRESHOLD = 80
const BROAD_COMMIT_THRESHOLD = 40

export const GitHistoryInputSchema = z
  .object({
    cwd: z.string().min(1).optional().describe('Optional working directory used for repository discovery.'),
    base: z.string().min(1).default('origin/dev').describe('Base ref used to compute merge-base and branch delta.'),
    paths: z.array(z.string().min(1)).default([]).describe('Optional paths to gather per-path recent commit history.'),
    limit: z
      .number()
      .int()
      .positive()
      .max(200)
      .default(DEFAULT_LIMIT)
      .describe('Maximum commit history rows to return per query.'),
  })
  .describe('Input contract for read-only Git history context assembly.')

const GitHistorySummarySchema = z
  .object({
    commitCountSinceBase: z.number().int().nonnegative().describe('Number of commits since merge-base with base ref.'),
    changedFileCountSinceBase: z
      .number()
      .int()
      .nonnegative()
      .describe('Number of changed files since merge-base with base ref.'),
    deletedFileCountSinceBase: z
      .number()
      .int()
      .nonnegative()
      .describe('Number of deleted files since merge-base with base ref.'),
  })
  .describe('High-level history summary counts.')

export const GitHistoryOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates Git history context collection succeeded.'),
    repoRoot: z.string().min(1).describe('Resolved repository root.'),
    base: z.string().min(1).describe('Requested base ref.'),
    baseHead: z.string().nullable().describe('Resolved base ref SHA when available.'),
    mergeBase: z.string().nullable().describe('Merge-base SHA between HEAD and base ref when available.'),
    paths: z.array(z.string()).describe('Validated repo-relative paths used for path history queries.'),
    commitsSinceBase: z.array(GitCommitSchema).describe('Recent commits from merge-base..HEAD.'),
    changedFilesSinceBase: z.array(GitChangedFileSchema).describe('Changed files from merge-base...HEAD.'),
    pathHistory: z.array(GitPathHistoryEntrySchema).describe('Recent per-path commit history for requested paths.'),
    summary: GitHistorySummarySchema.describe('High-level commit/file summary.'),
    warnings: z.array(z.string()).describe('Warnings about missing refs, broad changes, or deleted files.'),
    suggestedNextCommands: z.array(z.string()).describe('Suggested follow-up Git inspection commands.'),
  })
  .describe('Output contract for read-only Git history context assembly.')

export type GitHistoryInput = z.infer<typeof GitHistoryInputSchema>
export type GitHistoryOutput = z.infer<typeof GitHistoryOutputSchema>

const unique = (items: string[]): string[] => [...new Set(items)]

const buildSuggestedCommands = ({
  base,
  mergeBase,
  paths,
  limit,
}: {
  base: string
  mergeBase: string | null
  paths: string[]
  limit: number
}): string[] => {
  const commands: string[] = [`git merge-base HEAD ${base}`, `git log --oneline -${limit}`]

  if (mergeBase) {
    commands.push(`git log --oneline -${limit} ${mergeBase}..HEAD`)
    commands.push(`git diff --stat ${mergeBase}...HEAD`)
    commands.push(`git diff --name-status ${mergeBase}...HEAD`)
  } else {
    commands.push(`git rev-parse --verify ${base}^{commit}`)
  }

  for (const path of paths) {
    commands.push(`git log --oneline -${limit} -- ${path}`)
  }

  return unique(commands)
}

export const collectGitHistory = async (input: GitHistoryInput): Promise<GitHistoryOutput> => {
  const cwd = resolve(input.cwd ?? process.cwd())
  const repoRoot = await resolveGitRepoRoot(cwd)
  const base = input.base
  const limit = input.limit
  const validatedPaths = resolvePathListWithinRepo({
    repoRoot,
    paths: input.paths,
  })
  const warnings: string[] = []

  const baseHead = await resolveGitRef({
    cwd: repoRoot,
    ref: base,
  })
  if (!baseHead) {
    warnings.push(`Base ref '${base}' could not be resolved in this repository.`)
  }

  const mergeBase = baseHead
    ? await resolveMergeBase({
        cwd: repoRoot,
        baseRef: base,
      })
    : null

  if (baseHead && !mergeBase) {
    warnings.push(`Merge-base between HEAD and '${base}' could not be resolved.`)
  }

  const commitsSinceBase = mergeBase
    ? await collectCommits({
        cwd: repoRoot,
        range: `${mergeBase}..HEAD`,
        limit,
      })
    : []

  const changedFilesSinceBaseRaw = mergeBase
    ? await collectChangedFiles({
        cwd: repoRoot,
        mergeBase,
      })
    : []

  const changedFilesSinceBase = changedFilesSinceBaseRaw.slice(0, MAX_CHANGED_FILES)
  if (changedFilesSinceBaseRaw.length > MAX_CHANGED_FILES) {
    warnings.push(`Changed file list was truncated to ${MAX_CHANGED_FILES} entries to keep output focused.`)
  }

  const pathHistory = await collectPathHistory({
    cwd: repoRoot,
    paths: validatedPaths,
    limit,
  })

  const deletedFileCountSinceBase = changedFilesSinceBaseRaw.filter((entry) => entry.status === 'D').length
  if (deletedFileCountSinceBase > 0) {
    warnings.push(`Branch includes ${deletedFileCountSinceBase} deleted file change(s) since merge-base.`)
  }

  if (changedFilesSinceBaseRaw.length > BROAD_CHANGED_FILE_THRESHOLD) {
    warnings.push(
      `Broad change surface: ${changedFilesSinceBaseRaw.length} changed files since merge-base (${BROAD_CHANGED_FILE_THRESHOLD}+).`,
    )
  }

  if (commitsSinceBase.length > BROAD_COMMIT_THRESHOLD) {
    warnings.push(
      `Broad commit range: ${commitsSinceBase.length} commits since merge-base (${BROAD_COMMIT_THRESHOLD}+).`,
    )
  }

  if (baseHead && mergeBase && baseHead !== mergeBase) {
    warnings.push(
      `Current branch merge-base (${mergeBase.slice(0, 12)}) differs from ${base} head (${baseHead.slice(0, 12)}).`,
    )
  }

  return {
    ok: true,
    repoRoot,
    base,
    baseHead,
    mergeBase,
    paths: validatedPaths,
    commitsSinceBase,
    changedFilesSinceBase,
    pathHistory,
    summary: {
      commitCountSinceBase: commitsSinceBase.length,
      changedFileCountSinceBase: changedFilesSinceBaseRaw.length,
      deletedFileCountSinceBase,
    },
    warnings,
    suggestedNextCommands: buildSuggestedCommands({
      base,
      mergeBase,
      paths: validatedPaths,
      limit,
    }),
  }
}

export const gitHistoryCli = makeCli({
  name: 'skills/plaited-context/scripts/git-history.ts',
  inputSchema: GitHistoryInputSchema,
  outputSchema: GitHistoryOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/git-history.ts '{"base":"origin/dev","paths":["src/modules"],"limit":20}'`,
    `  bun skills/plaited-context/scripts/git-history.ts --schema output`,
  ].join('\n'),
  run: collectGitHistory,
})

if (import.meta.main) {
  try {
    await gitHistoryCli(Bun.argv.slice(2))
  } catch (error) {
    console.error(JSON.stringify(buildStructuredCliError(error), null, 2))
    process.exit(1)
  }
}
