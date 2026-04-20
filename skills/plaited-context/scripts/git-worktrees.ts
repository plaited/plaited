import { resolve } from 'node:path'
import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  buildStructuredCliError,
  collectWorktrees,
  GitWorktreeEntrySchema,
  resolveGitRepoRoot,
} from './git-context.shared.ts'

export const GitWorktreesInputSchema = z
  .object({
    cwd: z.string().min(1).optional().describe('Optional working directory used for repository discovery.'),
  })
  .describe('Input contract for read-only Git worktree metadata collection.')

export const GitWorktreesOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates Git worktree metadata collection succeeded.'),
    repoRoot: z.string().min(1).describe('Resolved repository root.'),
    currentWorktree: z.string().min(1).describe('Absolute path for the current worktree root.'),
    worktrees: z.array(GitWorktreeEntrySchema).describe('Parsed worktree metadata entries.'),
    warnings: z.array(z.string()).describe('Warnings for prunable/missing worktrees that may be stale.'),
    suggestedNextCommands: z.array(z.string()).describe('Suggested follow-up Git worktree inspection commands.'),
  })
  .describe('Output contract for read-only Git worktree metadata collection.')

export type GitWorktreesInput = z.infer<typeof GitWorktreesInputSchema>
export type GitWorktreesOutput = z.infer<typeof GitWorktreesOutputSchema>

const unique = (items: string[]): string[] => [...new Set(items)]

export const collectGitWorktrees = async (input: GitWorktreesInput): Promise<GitWorktreesOutput> => {
  const cwd = resolve(input.cwd ?? process.cwd())
  const repoRoot = await resolveGitRepoRoot(cwd)
  const worktrees = await collectWorktrees({
    cwd: repoRoot,
    currentWorktree: repoRoot,
  })

  const warnings: string[] = []
  for (const worktree of worktrees) {
    if (!worktree.exists) {
      warnings.push(`Worktree path is missing on disk: ${worktree.path}`)
    }
    if (worktree.prunableReason !== null) {
      warnings.push(`Worktree may be stale or prunable: ${worktree.path}`)
    }
  }

  const suggestedNextCommands = unique([
    'git worktree list --porcelain',
    'git branch --all --verbose',
    'git status --short --branch',
  ])

  return {
    ok: true,
    repoRoot,
    currentWorktree: repoRoot,
    worktrees,
    warnings,
    suggestedNextCommands,
  }
}

export const gitWorktreesCli = makeCli({
  name: 'skills/plaited-context/scripts/git-worktrees.ts',
  inputSchema: GitWorktreesInputSchema,
  outputSchema: GitWorktreesOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/git-worktrees.ts '{}'`,
    `  bun skills/plaited-context/scripts/git-worktrees.ts --schema output`,
  ].join('\n'),
  run: collectGitWorktrees,
})

if (import.meta.main) {
  try {
    await gitWorktreesCli(Bun.argv.slice(2))
  } catch (error) {
    console.error(JSON.stringify(buildStructuredCliError(error), null, 2))
    process.exit(1)
  }
}
