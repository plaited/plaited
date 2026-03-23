import { join } from 'node:path'

const REPO_ROOT = join(import.meta.dir, '..')
const WORKTREES_ROOT = join(REPO_ROOT, '.worktrees')

export const resolveRepoPath = (...segments: string[]) => join(REPO_ROOT, ...segments)

export const resolveWorkspacePath = (workspaceName: string, ...segments: string[]) =>
  join(WORKTREES_ROOT, workspaceName, ...segments)
