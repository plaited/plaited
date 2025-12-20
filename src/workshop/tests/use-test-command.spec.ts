import { expect, test } from 'bun:test'
import { join } from 'node:path'

const cwd = join(import.meta.dir, 'fixtures')
const fixturesDir = join(cwd, 'stories')

// Helper to run test command as subprocess and capture output
const runTestCommand = async ({
  colorScheme = 'light',
  port = 0,
}: {
  colorScheme?: 'light' | 'dark'
  port?: number
} = {}) => {
  const output: string[] = []

  // Create subprocess running the test command
  const proc = Bun.spawn(
    [
      'bun',
      join(import.meta.dir, '../cli.ts'),
      'test',
      '-d',
      cwd,
      '-p',
      String(port),
      '--color-scheme',
      colorScheme,
      fixturesDir,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )

  // Capture stdout and stderr
  const stdoutReader = proc.stdout.getReader()
  const stderrReader = proc.stderr.getReader()
  const decoder = new TextDecoder()

  // Read output streams
  const readStreams = async () => {
    await Promise.all([
      (async () => {
        while (true) {
          const { done, value } = await stdoutReader.read()
          if (done) break
          output.push(decoder.decode(value))
        }
      })(),
      (async () => {
        while (true) {
          const { done, value } = await stderrReader.read()
          if (done) break
          output.push(decoder.decode(value))
        }
      })(),
    ])
  }

  // Wait for process to complete
  await Promise.all([proc.exited, readStreams()])

  return output.join('')
}

test(
  'useTestCommand: executes test runner and reports results',
  async () => {
    const output = await runTestCommand({ colorScheme: 'light', port: 0 })

    // Should check for Playwright
    expect(output).toContain('Checking Playwright installation')

    // Should initialize runner
    expect(output).toContain('Initializing test runner')

    // Should show test results
    expect(output).toContain('Test Summary')

    // Note: Full test results validation is in use-runner.spec.ts
  },
  { timeout: 60000 },
)

test(
  'useTestCommand: uses provided port parameter',
  async () => {
    const output = await runTestCommand({ colorScheme: 'light', port: 5555 })

    // Verify the command ran and used the port
    expect(output).toContain('Checking Playwright')
    expect(output).toContain('Port: 5555')
  },
  { timeout: 60000 },
)

test(
  'useTestCommand: uses provided colorScheme parameter',
  async () => {
    const output = await runTestCommand({ colorScheme: 'dark', port: 0 })

    // Verify the command ran and used the colorScheme
    expect(output).toContain('Checking Playwright')
    expect(output).toContain('🎨 Color scheme: dark')
  },
  { timeout: 60000 },
)
