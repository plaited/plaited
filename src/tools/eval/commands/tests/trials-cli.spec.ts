import { describe, expect, test } from 'bun:test'
import type { TrialsConfig } from '../trials.ts'

// ============================================================================
// TrialsConfig type
// ============================================================================

describe('TrialsConfig configuration', () => {
  test('TrialsConfig type accepts valid configuration', () => {
    const config: TrialsConfig = {
      promptsPath: '/tmp/prompts.jsonl',
      schemaPath: './schemas/claude-headless.json',
      k: 5,
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
    expect(config.k).toBe(5)
    expect(config.concurrency).toBe(4)
    expect(config.workspaceDir).toBe('/tmp/workspaces')
  })

  test('TrialsConfig allows minimal configuration', () => {
    const config: TrialsConfig = {
      promptsPath: '/tmp/prompts.jsonl',
      schemaPath: './test-schema.json',
      k: 3,
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

  test('TrialsConfig accepts prompts without promptsPath', () => {
    const config: TrialsConfig = {
      schemaPath: './test-schema.json',
      k: 3,
      prompts: [{ id: 't1', input: 'hello' }],
    }

    expect(config.promptsPath).toBeUndefined()
    expect(config.prompts).toHaveLength(1)
  })
})

// ============================================================================
// CLI Help Output
// ============================================================================

describe('trials CLI', () => {
  test('displays help with --help flag', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'trials', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    expect(stdout).toContain('Usage: agent-eval-harness trials')
    expect(stdout).toContain('prompts.jsonl')
    expect(stdout).toContain('-o, --output')
    expect(stdout).toContain('-k')
    expect(stdout).toContain('-c, --cwd')
    expect(stdout).toContain('-t, --timeout')
    expect(stdout).toContain('--progress')
    expect(stdout).toContain('-g, --grader')
    expect(stdout).toContain('-s, --schema')
    expect(stdout).toContain('pass@k')
    expect(stdout).toContain('-j, --concurrency')
    expect(stdout).toContain('--workspace-dir')
    expect(stdout).toContain('--stdin')
  })

  test('shows error for --stdin with positional file', async () => {
    const proc = Bun.spawn(
      ['bun', './bin/cli.ts', 'trials', '/tmp/prompts.jsonl', '--stdin', '-s', '/tmp/schema.json'],
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
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'trials'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    expect(exitCode).not.toBe(0)
    expect(stderr).toContain('prompts.jsonl path is required')
  })

  test('shows error for missing schema argument', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'trials', '/tmp/prompts.jsonl'], {
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
      ['bun', './bin/cli.ts', 'trials', '/tmp/prompts.jsonl', '-s', '/tmp/schema.json', '-j', 'abc'],
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
      ['bun', './bin/cli.ts', 'trials', '/tmp/prompts.jsonl', '-s', '/tmp/schema.json', '-j', '0'],
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

// ============================================================================
// Schemas CLI
// ============================================================================

describe('schemas CLI', () => {
  test('displays help with --help flag', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'schemas', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    expect(stdout).toContain('Usage: agent-eval-harness schemas')
    expect(stdout).toContain('-o, --output')
    expect(stdout).toContain('-j, --json')
    expect(stdout).toContain('-s, --split')
    expect(stdout).toContain('-l, --list')
    expect(stdout).toContain('Available Schemas')
  })

  test('lists schemas with --list flag', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'schemas', '--list'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    expect(stdout).toContain('Available schemas')
    expect(stdout).toContain('PromptCase')
    expect(stdout).toContain('CaptureResult')
    expect(stdout).toContain('GraderResult')
  })

  test('exports schema as JSON', async () => {
    const proc = Bun.spawn(['bun', './bin/cli.ts', 'schemas', 'PromptCase', '--json'], {
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const stdout = await new Response(proc.stdout).text()
    await proc.exited

    const schema = JSON.parse(stdout)
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema')
    expect(schema.title).toBe('PromptCase')
    expect(schema.type).toBe('object')
  })
})
