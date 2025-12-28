import { expect, test } from 'bun:test'
import { join } from 'node:path'

const cwd = join(import.meta.dir, 'fixtures')
const fixturesDir = join(cwd, 'stories')

// Helper to run dev command as subprocess and capture output
const runDevCommand = async ({
  colorScheme = 'light',
  port = 0,
  execArgv = [],
}: {
  colorScheme?: 'light' | 'dark'
  port?: number
  execArgv?: string[]
} = {}) => {
  const output: string[] = []

  // Create subprocess running the dev command
  const proc = Bun.spawn(
    [
      'bun',
      ...execArgv,
      join(import.meta.dir, '../../cli.ts'),
      'dev',
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

  // Read output in background
  const readOutput = async () => {
    const readers = [
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
    ]
    await Promise.race(readers)
  }

  readOutput()

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // Send SIGINT to subprocess
  proc.kill('SIGINT')

  // Wait for cleanup
  await new Promise((resolve) => setTimeout(resolve, 500))

  return output.join('')
}

test(
  'useDevCommand: starts server and lists story URLs',
  async () => {
    const output = await runDevCommand({ colorScheme: 'light', port: 0 })

    // Should list story URLs with export names
    expect(output).toContain('basicStory')
    expect(output).toContain('http://localhost')

    // Should show hot reload message
    expect(output).toContain('Press Ctrl+C to exit')
  },
  { timeout: 30000 },
)

test(
  'useDevCommand: detects when NOT in hot mode',
  async () => {
    const output = await runDevCommand({ colorScheme: 'light', port: 0 })

    // Should suggest using --hot
    expect(output).toContain('Run with "bun --hot plaited dev" to enable hot reload')
  },
  { timeout: 30000 },
)

test(
  'useDevCommand: detects when IN hot mode',
  async () => {
    const output = await runDevCommand({
      colorScheme: 'dark',
      port: 0,
      execArgv: ['--hot'],
    })

    // Should show hot reload active message
    expect(output).toContain('Hot reload mode active')
    // Should use the provided colorScheme
    expect(output).toContain('🎨 Color scheme: dark')
  },
  { timeout: 30000 },
)

test(
  'useDevCommand: handles SIGINT gracefully',
  async () => {
    const output = await runDevCommand({ colorScheme: 'light', port: 0 })

    // Should show shutdown messages
    expect(output).toContain('Shutting down development server')
    expect(output).toContain('Server stopped')
  },
  { timeout: 30000 },
)
