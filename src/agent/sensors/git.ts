/**
 * Git sensor — reference implementation of the SensorFactory contract.
 *
 * @remarks
 * Reads recent commits and working tree status via `Bun.$`,
 * diffs against the previous snapshot to detect new commits
 * and status changes. This is a read-only observer — it never
 * modifies the repository.
 *
 * @public
 */

import type { SensorFactory, SensorSnapshot } from '../agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Raw state captured by `read()`.
 *
 * @public
 */
export type GitSensorData = {
  headSha: string
  commits: string[]
  status: string[]
}

/**
 * Delta produced by `diff()` when changes are detected.
 *
 * @public
 */
export type GitSensorDelta = {
  newCommits: string[]
  statusChanges: string[]
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a git sensor that watches for new commits and working tree changes.
 *
 * @param cwd - Working directory for git commands (defaults to process.cwd())
 * @returns A {@link SensorFactory} for the git sensor
 *
 * @public
 */
export const createGitSensor = (cwd?: string): SensorFactory => ({
  name: 'git',

  async read(signal: AbortSignal): Promise<GitSensorData> {
    const dir = cwd ?? process.cwd()

    // Run git log and git status in parallel
    const [logResult, statusResult] = await Promise.all([
      Bun.$`git log --oneline -10`.cwd(dir).nothrow().quiet(),
      Bun.$`git status --porcelain`.cwd(dir).nothrow().quiet(),
    ])

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const logText = logResult.text().trim()
    const statusText = statusResult.text().trim()

    // Parse HEAD SHA from first log line
    const commits = logText ? logText.split('\n') : []
    const headSha = commits[0]?.split(' ')[0] ?? ''

    // Parse status lines (filter empty)
    const status = statusText ? statusText.split('\n').filter(Boolean) : []

    return { headSha, commits, status }
  },

  diff(current: unknown, previous: SensorSnapshot | null): GitSensorDelta | null {
    const curr = current as GitSensorData

    if (!previous) {
      // First run — report everything as new
      return curr.commits.length > 0 || curr.status.length > 0
        ? { newCommits: curr.commits, statusChanges: curr.status }
        : null
    }

    const prev = previous.data as GitSensorData

    // Find new commits: commits in current that weren't in previous
    const prevCommitSet = new Set(prev.commits)
    const newCommits = curr.commits.filter((c) => !prevCommitSet.has(c))

    // Compare status lines
    const prevStatusSet = new Set(prev.status)
    const currStatusSet = new Set(curr.status)
    const statusChanges = [
      ...curr.status.filter((s) => !prevStatusSet.has(s)),
      ...prev.status.filter((s) => !currStatusSet.has(s)).map((s) => `-${s}`),
    ]

    if (newCommits.length === 0 && statusChanges.length === 0) {
      return null
    }

    return { newCommits, statusChanges }
  },

  snapshotPath: 'git.json',
})
