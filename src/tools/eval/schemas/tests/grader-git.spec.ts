/**
 * Tests for git-based grader fixture.
 *
 * @remarks
 * Verifies that graders can use git to detect environmental outcomes
 * and return structured outcome data.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Grader } from '../schemas.ts'

describe('Git-based grader', () => {
  let tempDir: string
  let grader: Grader

  beforeEach(async () => {
    // Create temporary directory
    tempDir = await mkdtemp(join(tmpdir(), 'git-grader-test-'))

    // Initialize git repo
    await Bun.$`git -C ${tempDir} init`.quiet()
    await Bun.$`git -C ${tempDir} config user.email "test@test.com"`.quiet()
    await Bun.$`git -C ${tempDir} config user.name "Test User"`.quiet()

    // Load the git-based grader
    const module = await import('./fixtures/grader-git.ts')
    grader = module.grade
  })

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true })
  })

  test('detects newly created files', async () => {
    // Create a new file (untracked)
    await Bun.write(join(tempDir, 'button.tsx'), 'export const Button = () => <button>Click</button>')

    const result = await grader({
      input: 'Create a button component',
      output: 'I created Button.tsx',
      hint: 'button',
      cwd: tempDir,
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
    expect(result.reasoning).toContain('button.tsx')
    expect(result.outcome).toBeDefined()
    expect(result.outcome?.filesCreated).toEqual(['button.tsx'])
    expect(result.outcome?.type).toBe('git_status_check')
  })

  test('detects modified files', async () => {
    // Create and commit a file
    await Bun.write(join(tempDir, 'config.ts'), 'export const config = { value: 1 }')
    await Bun.$`git -C ${tempDir} add config.ts`.quiet()
    await Bun.$`git -C ${tempDir} commit -m "Initial commit"`.quiet()

    // Modify the file
    await Bun.write(join(tempDir, 'config.ts'), 'export const config = { value: 2 }')

    const result = await grader({
      input: 'Update config value',
      output: 'I updated the config',
      hint: 'config',
      cwd: tempDir,
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
    expect(result.reasoning).toContain('config.ts')
    expect(result.outcome).toBeDefined()
    expect(result.outcome?.filesModified).toEqual(['config.ts'])
    expect(result.outcome?.type).toBe('git_status_check')
  })

  test('fails when no changes detected', async () => {
    // No files created or modified
    const result = await grader({
      input: 'Create a button component',
      output: 'I created a button component',
      cwd: tempDir,
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('No file changes detected')
    expect(result.outcome).toBeDefined()
    expect(result.outcome?.filesCreated).toEqual([])
    expect(result.outcome?.filesModified).toEqual([])
  })

  test('partial score when changes do not match hint', async () => {
    // Create a file that does not match the hint
    await Bun.write(join(tempDir, 'unrelated.ts'), 'export const foo = 1')

    const result = await grader({
      input: 'Create a button component',
      output: 'I created something',
      hint: 'button',
      cwd: tempDir,
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0.5) // Has changes but doesn't match hint
    expect(result.reasoning).toContain('do not match hint')
    expect(result.outcome?.filesCreated).toEqual(['unrelated.ts'])
  })

  test('handles missing cwd parameter', async () => {
    const result = await grader({
      input: 'Create a button component',
      output: 'I created a button',
      hint: 'button',
      // cwd not provided
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toBe('No working directory provided')
  })

  test('handles non-git directory', async () => {
    // Create a non-git temp directory
    const nonGitDir = await mkdtemp(join(tmpdir(), 'non-git-test-'))

    try {
      const result = await grader({
        input: 'Create a button component',
        output: 'I created a button',
        cwd: nonGitDir,
      })

      expect(result.pass).toBe(false)
      expect(result.score).toBe(0)
      expect(result.reasoning).toBe('Not a git repository')
    } finally {
      await rm(nonGitDir, { recursive: true, force: true })
    }
  })

  test('works without hint parameter', async () => {
    // Create a file
    await Bun.write(join(tempDir, 'any-file.ts'), 'export const x = 1')

    const result = await grader({
      input: 'Create a file',
      output: 'I created a file',
      cwd: tempDir,
      // hint not provided
    })

    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
    expect(result.reasoning).toContain('any-file.ts')
    expect(result.outcome?.filesCreated).toEqual(['any-file.ts'])
  })

  test('returns structured outcome for downstream analysis', async () => {
    // Create multiple files
    await Bun.write(join(tempDir, 'button.tsx'), 'export const Button = () => <button />')
    await Bun.write(join(tempDir, 'input.tsx'), 'export const Input = () => <input />')

    const result = await grader({
      input: 'Create UI components',
      output: 'I created Button and Input components',
      cwd: tempDir,
    })

    expect(result.outcome).toBeDefined()
    expect(result.outcome?.type).toBe('git_status_check')
    expect(result.outcome?.filesCreated).toBeInstanceOf(Array)
    expect(result.outcome?.filesCreated).toHaveLength(2)
    expect(result.outcome?.filesCreated).toContain('button.tsx')
    expect(result.outcome?.filesCreated).toContain('input.tsx')
    expect(result.outcome?.filesModified).toEqual([])
  })

  test('rejects path with command injection attempt', async () => {
    const result = await grader({
      input: 'Create a file',
      output: 'Created file',
      cwd: '/tmp/test; rm -rf /', // Command injection attempt
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('Invalid working directory path')
  })

  test('rejects path with directory traversal', async () => {
    const result = await grader({
      input: 'Create a file',
      output: 'Created file',
      cwd: '/tmp/../../../etc', // Directory traversal
    })

    expect(result.pass).toBe(false)
    expect(result.score).toBe(0)
    expect(result.reasoning).toContain('Invalid working directory path')
  })

  test('rejects path with shell metacharacters', async () => {
    const dangerousPaths = ['/tmp/test$(whoami)', '/tmp/test`id`', '/tmp/test|cat', '/tmp/test&echo', '/tmp/test>out']

    for (const path of dangerousPaths) {
      const result = await grader({
        input: 'Create a file',
        output: 'Created file',
        cwd: path,
      })

      expect(result.pass).toBe(false)
      expect(result.score).toBe(0)
      expect(result.reasoning).toContain('Invalid working directory path')
    }
  })
})
