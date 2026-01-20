import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { exec } from '../bash-exec.ts'

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = '/tmp/claude/bash-exec-test'

beforeEach(async () => {
  await Bun.$`mkdir -p ${TEST_DIR}`.quiet()
})

afterEach(async () => {
  await Bun.$`rm -rf ${TEST_DIR}`.quiet()
})

// ============================================================================
// exec Tests
// ============================================================================

describe('exec', () => {
  test('executes simple command', async () => {
    const result = await exec({ command: 'echo "hello world"' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.stdout.trim()).toBe('hello world')
      expect(result.exitCode).toBe(0)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  test('captures stderr', async () => {
    const result = await exec({ command: 'echo "error" >&2' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.stderr.trim()).toBe('error')
    }
  })

  test('returns non-zero exit code', async () => {
    const result = await exec({ command: 'exit 1' })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.exitCode).toBe(1)
      expect(result.error).toContain('exit code 1')
    }
  })

  test('respects cwd option', async () => {
    const result = await exec({ command: 'pwd', cwd: TEST_DIR })

    expect(result.success).toBe(true)
    if (result.success) {
      // macOS symlinks /tmp to /private/tmp, so use toContain
      expect(result.stdout.trim()).toContain('bash-exec-test')
    }
  })

  test('handles piped commands', async () => {
    const result = await exec({ command: 'echo "a b c" | wc -w' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.stdout.trim()).toBe('3')
    }
  })

  test('handles environment variables', async () => {
    const result = await exec({
      command: 'echo $MY_VAR',
      env: { MY_VAR: 'custom_value' },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.stdout.trim()).toBe('custom_value')
    }
  })

  test('handles command that writes file', async () => {
    const testFile = join(TEST_DIR, 'output.txt')

    const result = await exec({
      command: `echo "test content" > ${testFile}`,
    })

    expect(result.success).toBe(true)

    const content = await Bun.file(testFile).text()
    expect(content.trim()).toBe('test content')
  })

  test('handles multiline output', async () => {
    const result = await exec({ command: 'printf "line1\\nline2\\nline3"' })

    expect(result.success).toBe(true)
    if (result.success) {
      const lines = result.stdout.trim().split('\n')
      expect(lines).toEqual(['line1', 'line2', 'line3'])
    }
  })

  test('includes duration in result', async () => {
    const result = await exec({ command: 'sleep 0.1' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.durationMs).toBeGreaterThanOrEqual(50) // At least 50ms
    }
  })

  test('handles command with special characters', async () => {
    const result = await exec({ command: 'echo "hello $USER"' })

    expect(result.success).toBe(true)
    // $USER should expand to the current user
    if (result.success) {
      expect(result.stdout.trim()).toContain('hello')
    }
  })
})

// ============================================================================
// Timeout Tests (slower, isolated)
// ============================================================================

describe('exec timeout', () => {
  test('respects timeout option', async () => {
    const result = await exec({
      command: 'sleep 10',
      timeout: 100, // 100ms timeout
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      // AbortController abort can throw different error messages
      expect(result.error).toBeDefined()
      expect(typeof result.error).toBe('string')
    }
  }, 5000) // Test timeout of 5 seconds
})
