import { expect, test } from 'bun:test'
import { join } from 'node:path'
import type { TestResult } from '../use-runner.ts'

const cwd = join(import.meta.dir, 'fixtures')
const fixturesDir = join(cwd, 'stories')

// Helper to run useRunner as subprocess and capture JSON results
const runRunner = async ({
  cwd,
  colorScheme = 'light',
  port = 0,
  paths,
}: {
  cwd: string
  colorScheme?: 'light' | 'dark'
  port?: number
  paths: string[]
}) => {
  const harnessPath = join(import.meta.dir, 'use-runner.harness.ts')

  // Create subprocess running the runner harness
  const proc = Bun.spawn(['bun', harnessPath, '-d', cwd, '-p', String(port), '--color-scheme', colorScheme, ...paths], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdoutReader = proc.stdout.getReader()
  const stderrReader = proc.stderr.getReader()
  const decoder = new TextDecoder()

  let output = ''
  let errorOutput = ''

  // Read output streams
  const readStreams = async () => {
    await Promise.all([
      (async () => {
        while (true) {
          const { done, value } = await stdoutReader.read()
          if (done) break
          output += decoder.decode(value)
        }
      })(),
      (async () => {
        while (true) {
          const { done, value } = await stderrReader.read()
          if (done) break
          errorOutput += decoder.decode(value)
        }
      })(),
    ])
  }

  // Wait for process to complete
  await Promise.all([proc.exited, readStreams()])

  // Parse JSON output
  try {
    const results = JSON.parse(output.trim()) as {
      passed: TestResult[]
      failed: TestResult[]
    }
    return results
  } catch (error) {
    console.error('Failed to parse runner output:', output)
    console.error('Error output:', errorOutput)
    throw new Error(`Failed to parse runner output: ${error}`)
  }
}

test(
  'useRunner: should execute stories and report results via callback',
  async () => {
    const { passed, failed } = await runRunner({
      cwd,
      colorScheme: 'light',
      port: 0,
      paths: [fixturesDir],
    })

    // Verify results structure
    expect(passed.length + failed.length).toBeGreaterThan(0)
    expect(passed.every((r) => r.passed === true)).toBe(true)
    expect(failed.every((r) => r.passed === false)).toBe(true)

    // Verify each result has required properties
    ;[...passed, ...failed].forEach((result) => {
      expect(result.story).toBeDefined()
      expect(result.story.exportName).toBeDefined()
      expect(result.story.filePath).toBeDefined()
      expect(result.story.route).toBeDefined()
      expect(result.story.entryPath).toBeDefined()
      expect(result.story.type).toMatch(/interaction|snapshot/)
      expect(typeof result.passed).toBe('boolean')
    })
  },
  { timeout: 60000 },
)

test(
  'useRunner: should discover stories from subdirectories',
  async () => {
    const { passed, failed } = await runRunner({
      cwd,
      colorScheme: 'light',
      port: 0,
      paths: [fixturesDir],
    })

    const allResults = [...passed, ...failed]

    // Should find stories in subdirectories (filtering/)
    const subDirStories = allResults.filter((r) => r.story.filePath.includes('/filtering/'))
    expect(subDirStories.length).toBeGreaterThan(0)

    // Verify story names from subdirectory
    const exportNames = allResults.map((r) => r.story.exportName)
    expect(exportNames).toContain('onlyStory')
    expect(exportNames).toContain('activeStory')
  },
  { timeout: 60000 },
)

test(
  'useRunner: should handle mixed story types (interaction and snapshot)',
  async () => {
    const { passed, failed } = await runRunner({
      cwd,
      colorScheme: 'light',
      port: 0,
      paths: [fixturesDir],
    })

    const allResults = [...passed, ...failed]

    // Verify we have both types
    const hasSnapshot = allResults.some((r) => r.story.type === 'snapshot')
    const hasInteraction = allResults.some((r) => r.story.type === 'interaction')
    expect(hasSnapshot).toBe(true)
    expect(hasInteraction).toBe(true)
  },
  { timeout: 60000 },
)

test(
  'useRunner: should report passed tests correctly',
  async () => {
    const { passed, failed } = await runRunner({
      cwd,
      colorScheme: 'light',
      port: 0,
      paths: [fixturesDir],
    })

    // Verify there are passed results
    expect(passed.length).toBeGreaterThan(0)

    // Verify passed tests have passed=true
    passed.forEach((result) => {
      expect(result.passed).toBe(true)
      expect(result.error).toBeUndefined()
    })

    // Verify failed tests have passed=false and error (if any)
    failed.forEach((result) => {
      expect(result.passed).toBe(false)
      expect(result.error).toBeDefined()
    })
  },
  { timeout: 60000 },
)

test(
  'useRunner: should handle empty paths gracefully',
  async () => {
    const emptyDir = join(cwd, 'entry-routes') // Directory with no .stories.tsx

    const { passed, failed } = await runRunner({
      cwd: emptyDir,
      colorScheme: 'light',
      port: 0,
      paths: [emptyDir],
    })

    // Should have no results
    expect(passed.length).toBe(0)
    expect(failed.length).toBe(0)
  },
  { timeout: 60000 },
)

test(
  'useRunner: should include story metadata in results',
  async () => {
    const { passed, failed } = await runRunner({
      cwd,
      colorScheme: 'light',
      port: 0,
      paths: [fixturesDir],
    })

    const allResults = [...passed, ...failed]
    expect(allResults.length).toBeGreaterThan(0)

    // Verify metadata properties
    allResults.forEach((result) => {
      expect(result.story.route).toBeDefined()
      expect(result.story.route.startsWith('/')).toBe(true)
      expect(result.story.entryPath).toBeDefined()
      expect(result.story.entryPath.endsWith('.js')).toBe(true)
      expect(result.story.hasPlay !== undefined).toBe(true)
      expect(result.story.hasArgs !== undefined).toBe(true)
      expect(result.story.hasTemplate !== undefined).toBe(true)
      expect(result.story.hasParameters !== undefined).toBe(true)
      expect(result.story.timeout).toBeGreaterThan(0)
    })
  },
  { timeout: 60000 },
)
