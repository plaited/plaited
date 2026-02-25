import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { CaptureConfig } from '../capture.ts'
import { loadPrompts } from '../capture.ts'

// ============================================================================
// loadPrompts
// ============================================================================

describe('loadPrompts', () => {
  const testPromptFile = '/tmp/agent-eval-harness-test-prompts.jsonl'

  beforeEach(async () => {
    await Bun.$`rm -f ${testPromptFile}`.nothrow()
  })

  afterEach(async () => {
    await Bun.$`rm -f ${testPromptFile}`.nothrow()
  })

  test('loads single-turn prompts', async () => {
    await Bun.write(
      testPromptFile,
      `{"id": "t1", "input": "Hello"}
{"id": "t2", "input": "World"}`,
    )

    const prompts = await loadPrompts(testPromptFile)

    expect(prompts).toHaveLength(2)
    expect(prompts[0]?.id).toBe('t1')
    expect(prompts[0]?.input).toBe('Hello')
    expect(prompts[1]?.id).toBe('t2')
    expect(prompts[1]?.input).toBe('World')
  })

  test('loads multi-turn prompts', async () => {
    await Bun.write(testPromptFile, `{"id": "conv1", "input": ["Hi", "How are you?", "Bye"]}`)

    const prompts = await loadPrompts(testPromptFile)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.id).toBe('conv1')
    expect(Array.isArray(prompts[0]?.input)).toBe(true)
    expect(prompts[0]?.input).toEqual(['Hi', 'How are you?', 'Bye'])
  })

  test('loads prompts with hint field', async () => {
    await Bun.write(testPromptFile, `{"id": "t1", "input": "2+2?", "hint": "4"}`)

    const prompts = await loadPrompts(testPromptFile)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.hint).toBe('4')
  })

  test('loads prompts with metadata', async () => {
    await Bun.write(
      testPromptFile,
      `{"id": "t1", "input": "Test", "metadata": {"category": "math", "difficulty": "easy"}}`,
    )

    const prompts = await loadPrompts(testPromptFile)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.metadata).toEqual({ category: 'math', difficulty: 'easy' })
  })

  test('loads prompts with timeout override', async () => {
    await Bun.write(testPromptFile, `{"id": "t1", "input": "Slow task", "timeout": 120000}`)

    const prompts = await loadPrompts(testPromptFile)

    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.timeout).toBe(120000)
  })

  test('skips empty lines', async () => {
    await Bun.write(
      testPromptFile,
      `{"id": "t1", "input": "First"}

{"id": "t2", "input": "Second"}
`,
    )

    const prompts = await loadPrompts(testPromptFile)

    expect(prompts).toHaveLength(2)
  })

  test('throws on invalid JSON', async () => {
    await Bun.write(testPromptFile, 'not valid json')

    await expect(loadPrompts(testPromptFile)).rejects.toThrow()
  })

  test('throws on missing required fields', async () => {
    await Bun.write(testPromptFile, `{"id": "t1"}`) // missing input

    await expect(loadPrompts(testPromptFile)).rejects.toThrow()
  })
})

// ============================================================================
// runCapture configuration
// ============================================================================

describe('runCapture configuration', () => {
  test('CaptureConfig type accepts valid configuration', () => {
    // Type-level test - if this compiles, the types are correct
    const config: CaptureConfig = {
      promptsPath: '/tmp/prompts.jsonl',
      schemaPath: './schemas/claude-headless.json',
      outputPath: '/tmp/output.jsonl',
      cwd: '/tmp',
      timeout: 30000,
      progress: true,
      append: false,
      debug: false,
      concurrency: 4,
      workspaceDir: '/tmp/workspaces',
    }

    expect(config.promptsPath).toBe('/tmp/prompts.jsonl')
    expect(config.schemaPath).toBe('./schemas/claude-headless.json')
    expect(config.concurrency).toBe(4)
    expect(config.workspaceDir).toBe('/tmp/workspaces')
  })

  test('CaptureConfig allows minimal configuration', () => {
    const config: CaptureConfig = {
      promptsPath: '/tmp/prompts.jsonl',
      schemaPath: './test-schema.json',
    }

    expect(config.outputPath).toBeUndefined()
    expect(config.cwd).toBeUndefined()
    expect(config.timeout).toBeUndefined()
    expect(config.progress).toBeUndefined()
    expect(config.append).toBeUndefined()
    expect(config.grader).toBeUndefined()
    expect(config.concurrency).toBeUndefined()
    expect(config.workspaceDir).toBeUndefined()
  })

  test('CaptureConfig accepts prompts without promptsPath', () => {
    const config: CaptureConfig = {
      schemaPath: './test-schema.json',
      prompts: [{ id: 't1', input: 'hello' }],
    }

    expect(config.promptsPath).toBeUndefined()
    expect(config.prompts).toHaveLength(1)
  })
})

// ============================================================================
// CLI Help Output
// ============================================================================

describe('capture CLI', () => {
  test('displays help with --help flag', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'capture', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    expect(stdout).toContain('Usage: agent-eval-harness capture')
    expect(stdout).toContain('prompts.jsonl')
    expect(stdout).toContain('-o, --output')
    expect(stdout).toContain('-c, --cwd')
    expect(stdout).toContain('-t, --timeout')
    expect(stdout).toContain('--progress')
    expect(stdout).toContain('-g, --grader')
    expect(stdout).toContain('-s, --schema')
    expect(stdout).toContain('-j, --concurrency')
    expect(stdout).toContain('--workspace-dir')
    expect(stdout).toContain('--stdin')
  })

  test('shows error for --stdin with positional file', async () => {
    const proc = Bun.spawn(
      ['bun', './bin/cli.ts', 'capture', '/tmp/prompts.jsonl', '--stdin', '-s', '/tmp/schema.json'],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--stdin and prompts file argument are mutually exclusive')
  })

  test('shows error for missing prompts file argument', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'capture'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('prompts.jsonl path is required')
  })

  test('shows error for missing schema argument', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'capture', '/tmp/prompts.jsonl'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--schema is required')
  })

  test('shows error for invalid concurrency value', async () => {
    const proc = Bun.spawn(
      ['bun', './bin/cli.ts', 'capture', '/tmp/prompts.jsonl', '-s', '/tmp/schema.json', '-j', 'abc'],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--concurrency must be a positive integer')
  })

  test('shows error for zero concurrency', async () => {
    const proc = Bun.spawn(
      ['bun', './bin/cli.ts', 'capture', '/tmp/prompts.jsonl', '-s', '/tmp/schema.json', '-j', '0'],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--concurrency must be a positive integer')
  })

  test('shows error for negative concurrency', async () => {
    // Note: Using --concurrency=-1 format because -j -1 is ambiguous to parseArgs
    const proc = Bun.spawn(
      ['bun', './bin/cli.ts', 'capture', '/tmp/prompts.jsonl', '-s', '/tmp/schema.json', '--concurrency=-1'],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('--concurrency must be a positive integer')
  })
})
