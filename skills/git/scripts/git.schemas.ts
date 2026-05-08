import * as z from 'zod'

import { DEFAULT_HISTORY_LIMIT, GIT_MODES, MAX_HISTORY_LIMIT } from './git.constants.ts'

const GitModeSchema = z
  .enum([GIT_MODES.status, GIT_MODES.history, GIT_MODES.worktrees, GIT_MODES.context])
  .describe('Git command execution mode.')

export type GitMode = z.output<typeof GitModeSchema>

const GitCommitSchema = z
  .object({
    fullSha: z.string().min(1).describe('Full commit SHA.'),
    shortSha: z.string().min(1).describe('Short commit SHA.'),
    committedAt: z.string().min(1).describe('Commit timestamp in ISO format.'),
    subject: z.string().min(1).describe('Commit subject line.'),
  })
  .describe('Commit summary entry.')

export type GitCommit = z.output<typeof GitCommitSchema>

const GitChangedFileSchema = z
  .object({
    status: z.enum(['A', 'C', 'D', 'M', 'R', 'T', 'U', 'X']).describe('Normalized one-letter git change status.'),
    rawStatus: z.string().min(1).describe('Raw git status token, including rename/copy score when present.'),
    path: z.string().min(1).describe('Changed path relative to the repository root.'),
    oldPath: z.string().min(1).optional().describe('Previous path for rename/copy entries.'),
  })
  .describe('Changed file entry from a git diff.')

export type GitChangedFile = z.output<typeof GitChangedFileSchema>

const GitPathHistoryEntrySchema = z
  .object({
    path: z.string().min(1).describe('Validated path relative to the repository root.'),
    commits: z.array(GitCommitSchema).describe('Most recent commits touching this path.'),
  })
  .describe('Per-path recent commit history entry.')

export type GitPathHistoryEntry = z.output<typeof GitPathHistoryEntrySchema>

const GitWorktreeEntrySchema = z
  .object({
    path: z.string().min(1).describe('Worktree path (repo-root relative when inside repo root, absolute otherwise).'),
    head: z.string().min(1).describe('HEAD commit SHA for the worktree.'),
    branch: z.string().nullable().describe('Branch ref for this worktree when attached; null when detached.'),
    detached: z.boolean().describe('True when this worktree is detached.'),
    bare: z.boolean().describe('True when this worktree is bare.'),
    lockedReason: z.string().nullable().describe('Lock reason when present.'),
    prunableReason: z.string().nullable().describe('Prunable reason when reported by git.'),
    exists: z.boolean().describe('True when the worktree path exists on disk.'),
    isCurrent: z.boolean().describe('True when this is the current worktree.'),
  })
  .describe('Parsed worktree metadata from `git worktree list --porcelain`.')

export type GitWorktreeEntry = z.output<typeof GitWorktreeEntrySchema>

const GitDirtySummarySchema = z
  .object({
    isDirty: z.boolean().describe('True when staged, unstaged, or untracked files are present.'),
    stagedCount: z.number().int().nonnegative().describe('Count of staged files before capping.'),
    unstagedCount: z.number().int().nonnegative().describe('Count of unstaged files before capping.'),
    untrackedCount: z.number().int().nonnegative().describe('Count of untracked files before capping.'),
    stagedFiles: z.array(z.string()).describe('Staged file paths relative to repo root, capped for output safety.'),
    unstagedFiles: z.array(z.string()).describe('Unstaged file paths relative to repo root, capped for output safety.'),
    untrackedFiles: z
      .array(z.string())
      .describe('Untracked file paths relative to repo root, capped for output safety.'),
  })
  .describe('Worktree dirty-state summary.')

const GitStatusInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.status).describe('Runs repository status mode.'),
    cwd: z.string().min(1).optional().describe('Optional working directory used for repository discovery.'),
  })
  .strict()
  .describe('Input for `plaited git` status mode.')

export type GitStatusInput = z.output<typeof GitStatusInputSchema>

const GitHistoryInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.history).describe('Runs repository history mode.'),
    cwd: z.string().min(1).optional().describe('Optional working directory used for repository discovery.'),
    base: z.string().min(1).describe('Base ref used to compute merge-base and branch delta.'),
    paths: z.array(z.string().min(1)).default([]).describe('Optional paths for per-path recent commit history.'),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_HISTORY_LIMIT)
      .default(DEFAULT_HISTORY_LIMIT)
      .describe('Maximum commit history rows to return per query.'),
  })
  .strict()
  .describe('Input for `plaited git` history mode.')

export type GitHistoryInput = z.output<typeof GitHistoryInputSchema>

const GitWorktreesInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.worktrees).describe('Runs repository worktree mode.'),
    cwd: z.string().min(1).optional().describe('Optional working directory used for repository discovery.'),
  })
  .strict()
  .describe('Input for `plaited git` worktrees mode.')

export type GitWorktreesInput = z.output<typeof GitWorktreesInputSchema>

const GitContextInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.context).describe('Runs combined repository context mode.'),
    cwd: z.string().min(1).optional().describe('Optional working directory used for repository discovery.'),
    base: z.string().min(1).describe('Base ref used to compute merge-base and branch delta.'),
    paths: z.array(z.string().min(1)).default([]).describe('Optional paths for per-path recent commit history.'),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_HISTORY_LIMIT)
      .default(DEFAULT_HISTORY_LIMIT)
      .describe('Maximum commit history rows to return per query.'),
    includeWorktrees: z
      .boolean()
      .default(false)
      .describe('When true, include parsed worktree metadata in context output.'),
  })
  .strict()
  .describe('Input for `plaited git` context mode.')

export type GitContextInput = z.output<typeof GitContextInputSchema>

export const GitCliInputSchema = z
  .discriminatedUnion('mode', [
    GitStatusInputSchema,
    GitHistoryInputSchema,
    GitWorktreesInputSchema,
    GitContextInputSchema,
  ])
  .describe('Input contract for the `plaited git` command.')

export type GitCliInput = z.output<typeof GitCliInputSchema>

const GitStatusOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates status collection succeeded.'),
    mode: z.literal(GIT_MODES.status),
    repoRoot: z.string().min(1).describe('Resolved repository root.'),
    branch: z.string().nullable().describe('Current branch name, or null when detached.'),
    head: z.string().min(1).describe('Current HEAD commit SHA.'),
    upstream: z.string().nullable().describe('Current branch upstream ref when configured.'),
    dirty: GitDirtySummarySchema.describe('Dirty-state summary for staged/unstaged/untracked changes.'),
    warnings: z.array(z.string()).describe('Warnings for broad output or missing upstream.'),
    suggestedNextCommands: z.array(z.string()).describe('Suggested follow-up git commands.'),
  })
  .strict()
  .describe('Output for `plaited git` status mode.')

export type GitStatusOutput = z.output<typeof GitStatusOutputSchema>

const GitHistorySummarySchema = z
  .object({
    commitCountSinceBase: z.number().int().nonnegative().describe('Commit count since merge-base with base ref.'),
    changedFileCountSinceBase: z.number().int().nonnegative().describe('Changed file count since merge-base.'),
    deletedFileCountSinceBase: z.number().int().nonnegative().describe('Deleted file count since merge-base.'),
  })
  .strict()
  .describe('High-level history summary counts.')

const GitHistoryOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates history collection succeeded.'),
    mode: z.literal(GIT_MODES.history),
    repoRoot: z.string().min(1).describe('Resolved repository root.'),
    base: z.string().min(1).describe('Requested base ref.'),
    baseHead: z.string().nullable().describe('Resolved base ref SHA when available.'),
    mergeBase: z.string().nullable().describe('Merge-base SHA between HEAD and base ref when available.'),
    paths: z.array(z.string()).describe('Validated repo-relative paths used for path history queries.'),
    commitsSinceBase: z.array(GitCommitSchema).describe('Recent commits from merge-base..HEAD.'),
    changedFilesSinceBase: z.array(GitChangedFileSchema).describe('Changed files from merge-base...HEAD.'),
    pathHistory: z.array(GitPathHistoryEntrySchema).describe('Recent per-path commit history for requested paths.'),
    summary: GitHistorySummarySchema.describe('High-level commit/file summary.'),
    warnings: z.array(z.string()).describe('Warnings about missing refs, broad changes, or truncation.'),
    suggestedNextCommands: z.array(z.string()).describe('Suggested follow-up git commands.'),
  })
  .strict()
  .describe('Output for `plaited git` history mode.')

export type GitHistoryOutput = z.output<typeof GitHistoryOutputSchema>

const GitWorktreesOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates worktree metadata collection succeeded.'),
    mode: z.literal(GIT_MODES.worktrees),
    repoRoot: z.string().min(1).describe('Resolved repository root.'),
    currentWorktree: z.string().min(1).describe('Current worktree path representation.'),
    worktrees: z.array(GitWorktreeEntrySchema).describe('Parsed worktree metadata entries.'),
    warnings: z.array(z.string()).describe('Warnings for prunable/missing worktrees that may be stale.'),
    suggestedNextCommands: z.array(z.string()).describe('Suggested follow-up git worktree inspection commands.'),
  })
  .strict()
  .describe('Output for `plaited git` worktrees mode.')

export type GitWorktreesOutput = z.output<typeof GitWorktreesOutputSchema>

const GitContextSummarySchema = z
  .object({
    commitCountSinceBase: z.number().int().nonnegative().describe('Commit count since merge-base with base ref.'),
    changedFileCountSinceBase: z.number().int().nonnegative().describe('Changed file count since merge-base.'),
    deletedFileCountSinceBase: z.number().int().nonnegative().describe('Deleted file count since merge-base.'),
    worktreeCount: z.number().int().nonnegative().describe('Number of detected worktrees when requested.'),
  })
  .strict()
  .describe('High-level git context summary counts.')

const GitContextOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates context collection succeeded.'),
    mode: z.literal(GIT_MODES.context),
    repoRoot: z.string().min(1).describe('Resolved repository root.'),
    branch: z.string().nullable().describe('Current branch name, or null when detached.'),
    head: z.string().min(1).describe('Current HEAD commit SHA.'),
    upstream: z.string().nullable().describe('Current branch upstream ref when configured.'),
    base: z.string().min(1).describe('Requested base ref used for comparison.'),
    baseHead: z.string().nullable().describe('Resolved base ref SHA when available.'),
    mergeBase: z.string().nullable().describe('Merge-base SHA between HEAD and base ref when available.'),
    dirty: GitDirtySummarySchema.describe('Dirty-state summary for staged/unstaged/untracked changes.'),
    commitsSinceBase: z.array(GitCommitSchema).describe('Recent commits from merge-base..HEAD.'),
    changedFilesSinceBase: z.array(GitChangedFileSchema).describe('Changed files from merge-base...HEAD.'),
    pathHistory: z
      .array(GitPathHistoryEntrySchema)
      .describe('Per-path recent commit history when paths were provided.'),
    worktrees: z.array(GitWorktreeEntrySchema).describe('Worktree metadata entries when requested.'),
    summary: GitContextSummarySchema.describe('High-level git context summary counts.'),
    warnings: z.array(z.string()).describe('Warnings about missing refs, dirty state, broad changes, or truncation.'),
    suggestedNextCommands: z.array(z.string()).describe('Suggested follow-up git commands.'),
  })
  .strict()
  .describe('Output for `plaited git` context mode.')

export type GitContextOutput = z.output<typeof GitContextOutputSchema>

export const GitCliOutputSchema = z
  .discriminatedUnion('mode', [
    GitStatusOutputSchema,
    GitHistoryOutputSchema,
    GitWorktreesOutputSchema,
    GitContextOutputSchema,
  ])
  .describe('Output contract for the `plaited git` command.')

export type GitCliOutput = z.output<typeof GitCliOutputSchema>
