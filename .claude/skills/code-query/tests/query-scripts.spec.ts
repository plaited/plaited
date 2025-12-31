import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const scriptsDir = join(import.meta.dir, '../scripts')
const cwd = process.cwd()

// Helper to run a script as subprocess and capture output
const runScript = async (scriptName: string, args: string[] = []) => {
  const proc = Bun.spawn(['bun', join(scriptsDir, scriptName), ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
}

describe('query-paths.ts', () => {
  test('outputs JSON with route and entryPath', async () => {
    const { stdout, exitCode } = await runScript('query-paths.ts', ['src/button.stories.tsx', 'PrimaryButton'])

    expect(exitCode).toBe(0)

    const result = JSON.parse(stdout)
    expect(result.route).toBe('/src/button--primary-button')
    expect(result.entryPath).toBe('/src/button.stories.js')
  })

  test('shows usage when missing arguments', async () => {
    const { stderr, exitCode } = await runScript('query-paths.ts', [])

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})

describe('query-story-url.ts', () => {
  test('outputs JSON with url and templateUrl', async () => {
    const { stdout, exitCode } = await runScript('query-story-url.ts', ['src/button.stories.tsx', 'PrimaryButton'])

    expect(exitCode).toBe(0)

    const result = JSON.parse(stdout)
    expect(result.url).toBe('http://localhost:3000/src/button--primary-button')
    expect(result.templateUrl).toBe('http://localhost:3000/src/button--primary-button.template')
  })

  test('respects --port option', async () => {
    const { stdout, exitCode } = await runScript('query-story-url.ts', [
      'src/button.stories.tsx',
      'PrimaryButton',
      '--port',
      '3500',
    ])

    expect(exitCode).toBe(0)

    const result = JSON.parse(stdout)
    expect(result.url).toBe('http://localhost:3500/src/button--primary-button')
  })

  test('shows usage when missing arguments', async () => {
    const { stderr, exitCode } = await runScript('query-story-url.ts', [])

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})

describe('query-stories.ts', () => {
  test('shows usage when no paths provided', async () => {
    const { stderr, exitCode } = await runScript('query-stories.ts', [])

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})

describe('query-templates.ts', () => {
  test('shows usage when no paths provided', async () => {
    const { stderr, exitCode } = await runScript('query-templates.ts', [])

    expect(exitCode).toBe(1)
    expect(stderr).toContain('Usage:')
  })
})

describe('query-analyze.ts', () => {
  test('shows help with --help flag', async () => {
    const { stdout, exitCode } = await runScript('query-analyze.ts', ['--help'])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Query Analyze')
    expect(stdout).toContain('--stories')
    expect(stdout).toContain('--templates')
    expect(stdout).toContain('--urls')
  })

  test('shows help when no paths provided', async () => {
    const { stdout, exitCode } = await runScript('query-analyze.ts', [])

    expect(exitCode).toBe(0)
    expect(stdout).toContain('Query Analyze')
  })
})
