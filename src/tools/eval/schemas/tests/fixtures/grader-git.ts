/**
 * Test fixture: Git-based grader that detects file changes.
 *
 * @remarks
 * This grader uses git to detect environmental outcomes instead of just
 * checking output text. It demonstrates the "grade outcomes, not paths" principle.
 *
 * SECURITY NOTE: This fixture validates the cwd parameter to prevent command injection.
 * When implementing your own git-based graders, always validate paths from untrusted sources.
 * The cwd parameter should only come from trusted sources (process.cwd(), CLI flags, etc.).
 */

import { resolve } from 'node:path'
import type { Grader } from '../../schemas.ts'

/**
 * Validates that a path is safe to use in shell commands.
 *
 * @remarks
 * Rejects paths containing shell metacharacters or suspicious patterns
 * that could be used for command injection.
 *
 * @param path - The path to validate
 * @returns True if path appears safe, false otherwise
 */
const isValidPath = (path: string): boolean => {
  // Reject paths with shell metacharacters that could enable command injection
  const dangerousChars = /[;&|`$(){}[\]<>'"\\]/
  if (dangerousChars.test(path)) {
    return false
  }

  // Reject paths with suspicious patterns
  if (path.includes('..') || path.startsWith('-')) {
    return false
  }

  return true
}

export const grade: Grader = async ({ output: _output, hint, cwd }) => {
  // If no cwd provided, fall back to hint-based grading
  if (!cwd) {
    return {
      pass: false,
      score: 0,
      reasoning: 'No working directory provided',
    }
  }

  // SECURITY: Validate cwd to prevent command injection
  if (!isValidPath(cwd)) {
    return {
      pass: false,
      score: 0,
      reasoning: 'Invalid working directory path (contains suspicious characters)',
    }
  }

  // Normalize path to prevent directory traversal
  const safeCwd = resolve(cwd)

  // Check if we're in a git repo
  const isGit = await Bun.$`git -C ${safeCwd} rev-parse --git-dir 2>/dev/null`.nothrow()

  if (isGit.exitCode !== 0) {
    return {
      pass: false,
      score: 0,
      reasoning: 'Not a git repository',
    }
  }

  // Detect what files were created/modified using git
  // Note: This detects untracked (??) and modified (M) files.
  // Staged (A), renamed (R), deleted (D) files are not included in this example.
  const status = await Bun.$`git -C ${safeCwd} status --porcelain`.text()

  const filesCreated = status
    .split('\n')
    .filter((line) => line.startsWith('??')) // ?? = untracked files
    .map((line) => line.slice(3).trim())
    .filter(Boolean)

  const filesModified = status
    .split('\n')
    .filter((line) => line.startsWith(' M') || line.startsWith('M ')) // M = modified
    .map((line) => line.slice(3).trim())
    .filter(Boolean)

  const hasChanges = filesCreated.length > 0 || filesModified.length > 0

  // If hint is provided, check if any changed file matches the hint
  let matchesHint = true
  if (hint) {
    const allChangedFiles = [...filesCreated, ...filesModified]
    matchesHint = allChangedFiles.some((file) => file.toLowerCase().includes(hint.toLowerCase()))
  }

  const pass = hasChanges && matchesHint

  return {
    pass,
    score: pass ? 1.0 : hasChanges ? 0.5 : 0.0,
    reasoning: pass
      ? `Files changed: ${[...filesCreated, ...filesModified].join(', ')}`
      : hasChanges
        ? 'File changes do not match hint'
        : 'No file changes detected',
    outcome: {
      filesCreated,
      filesModified,
      type: 'git_status_check',
    },
  }
}
