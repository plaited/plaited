import { resolve } from 'node:path'
import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  buildStructuredCliError,
  collectDirtyState,
  GitChangedFileSchema,
  GitCommitSchema,
  GitPathHistoryEntrySchema,
  GitWorktreeEntrySchema,
  resolveCurrentBranch,
  resolveGitRepoRoot,
  resolveHead,
  resolveUpstream,
} from './git-context.shared.ts'
import { collectGitHistory, GitHistoryInputSchema } from './git-history.ts'
import { collectGitWorktrees, GitWorktreesInputSchema } from './git-worktrees.ts'

const DirtySummarySchema = z
  .object({
    isDirty: z.boolean().describe('True when staged, unstaged, or untracked files are present.'),
    stagedCount: z.number().int().nonnegative().describe('Count of staged files.'),
    unstagedCount: z.number().int().nonnegative().describe('Count of unstaged files.'),
    untrackedCount: z.number().int().nonnegative().describe('Count of untracked files.'),
    stagedFiles: z.array(z.string()).describe('Staged files relative to repo root.'),
    unstagedFiles: z.array(z.string()).describe('Unstaged files relative to repo root.'),
    untrackedFiles: z.array(z.string()).describe('Untracked files relative to repo root.'),
  })
  .describe('Worktree dirty-state summary.')

const GitContextSummarySchema = z
  .object({
    commitCountSinceBase: z.number().int().nonnegative().describe('Commit count since merge-base with base ref.'),
    changedFileCountSinceBase: z.number().int().nonnegative().describe('Changed file count since merge-base.'),
    deletedFileCountSinceBase: z.number().int().nonnegative().describe('Deleted file count since merge-base.'),
    worktreeCount: z.number().int().nonnegative().describe('Number of detected worktrees when requested.'),
  })
  .describe('High-level Git context summary counts.')

export const GitContextInputSchema = GitHistoryInputSchema.extend({
  includeWorktrees: z
    .boolean()
    .default(false)
    .describe('When true, include parsed worktree metadata in the assembled Git context output.'),
})
  .merge(GitWorktreesInputSchema)
  .describe('Input contract for read-only local Git context assembly.')

export const GitContextOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates Git context assembly completed successfully.'),
    repoRoot: z.string().min(1).describe('Resolved repository root.'),
    branch: z.string().nullable().describe('Current branch name, or null when detached.'),
    head: z.string().min(1).describe('Current HEAD commit SHA.'),
    upstream: z.string().nullable().describe('Current branch upstream ref when configured.'),
    base: z.string().min(1).describe('Requested base ref used for comparison.'),
    baseHead: z.string().nullable().describe('Resolved base ref SHA when available.'),
    mergeBase: z.string().nullable().describe('Merge-base SHA between HEAD and base ref when available.'),
    dirty: DirtySummarySchema.describe('Dirty-state summary for staged/unstaged/untracked changes.'),
    commitsSinceBase: z.array(GitCommitSchema).describe('Recent commits from merge-base..HEAD.'),
    changedFilesSinceBase: z.array(GitChangedFileSchema).describe('Changed files from merge-base...HEAD.'),
    pathHistory: z
      .array(GitPathHistoryEntrySchema)
      .describe('Per-path recent commit history when paths were provided.'),
    worktrees: z.array(GitWorktreeEntrySchema).describe('Parsed worktree metadata entries when requested.'),
    summary: GitContextSummarySchema.describe('High-level Git context summary counts.'),
    warnings: z
      .array(z.string())
      .describe('Warnings about dirty state, missing refs, broad changes, or stale worktrees.'),
    suggestedNextCommands: z.array(z.string()).describe('Suggested follow-up Git inspection commands.'),
  })
  .describe('Output contract for read-only local Git context assembly.')

export type GitContextInput = z.infer<typeof GitContextInputSchema>
export type GitContextOutput = z.infer<typeof GitContextOutputSchema>

const unique = (items: string[]): string[] => [...new Set(items)]

export const assembleGitContext = async (input: GitContextInput): Promise<GitContextOutput> => {
  const cwd = resolve(input.cwd ?? process.cwd())
  const repoRoot = await resolveGitRepoRoot(cwd)
  const base = input.base

  const [branch, head, upstream, dirtyState, history] = await Promise.all([
    resolveCurrentBranch({ cwd: repoRoot }),
    resolveHead({ cwd: repoRoot }),
    resolveUpstream({ cwd: repoRoot }),
    collectDirtyState({ cwd: repoRoot }),
    collectGitHistory({
      cwd: repoRoot,
      base: input.base,
      paths: input.paths,
      limit: input.limit,
    }),
  ])

  const worktreeContext = input.includeWorktrees
    ? await collectGitWorktrees({
        cwd: repoRoot,
      })
    : null

  const dirty = {
    isDirty:
      dirtyState.stagedFiles.length > 0 || dirtyState.unstagedFiles.length > 0 || dirtyState.untrackedFiles.length > 0,
    stagedCount: dirtyState.stagedFiles.length,
    unstagedCount: dirtyState.unstagedFiles.length,
    untrackedCount: dirtyState.untrackedFiles.length,
    stagedFiles: dirtyState.stagedFiles,
    unstagedFiles: dirtyState.unstagedFiles,
    untrackedFiles: dirtyState.untrackedFiles,
  }

  const warnings = [...history.warnings]
  if (dirty.isDirty) {
    warnings.push(
      `Dirty worktree detected: ${dirty.stagedCount} staged, ${dirty.unstagedCount} unstaged, ${dirty.untrackedCount} untracked.`,
    )
  }
  if (!upstream) {
    warnings.push('Current branch has no configured upstream tracking ref.')
  }

  for (const worktreeWarning of worktreeContext?.warnings ?? []) {
    warnings.push(worktreeWarning)
  }

  const deletedCount = history.summary.deletedFileCountSinceBase
  if (deletedCount > 0) {
    warnings.push(`Deleted files detected in branch changes: ${deletedCount}.`)
  }

  const suggestedNextCommands = unique([
    'git status --short --branch',
    'git log --oneline -20',
    ...history.suggestedNextCommands,
    ...(worktreeContext?.suggestedNextCommands ?? []),
    `bun skills/plaited-context/scripts/git-history.ts '{"base":"${base}","paths":${JSON.stringify(history.paths)},"limit":${input.limit}}'`,
  ])

  return {
    ok: true,
    repoRoot,
    branch,
    head,
    upstream,
    base,
    baseHead: history.baseHead,
    mergeBase: history.mergeBase,
    dirty,
    commitsSinceBase: history.commitsSinceBase,
    changedFilesSinceBase: history.changedFilesSinceBase,
    pathHistory: history.pathHistory,
    worktrees: worktreeContext?.worktrees ?? [],
    summary: {
      commitCountSinceBase: history.summary.commitCountSinceBase,
      changedFileCountSinceBase: history.summary.changedFileCountSinceBase,
      deletedFileCountSinceBase: deletedCount,
      worktreeCount: worktreeContext?.worktrees.length ?? 0,
    },
    warnings: unique(warnings),
    suggestedNextCommands,
  }
}

export const gitContextCli = makeCli({
  name: 'skills/plaited-context/scripts/git-context.ts',
  inputSchema: GitContextInputSchema,
  outputSchema: GitContextOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/git-context.ts '{"base":"origin/dev","paths":["skills/plaited-context"],"includeWorktrees":true}'`,
    `  bun skills/plaited-context/scripts/git-context.ts --schema output`,
  ].join('\n'),
  run: assembleGitContext,
})

if (import.meta.main) {
  try {
    await gitContextCli(Bun.argv.slice(2))
  } catch (error) {
    console.error(JSON.stringify(buildStructuredCliError(error), null, 2))
    process.exit(1)
  }
}
