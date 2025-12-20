/**
 * @internal
 * Test harness for running useRunner in a subprocess.
 * Accepts configuration via command-line args and outputs results as JSON.
 */
import { join } from 'node:path'
import type { TestResult } from '../use-runner.ts'
import { useRunner } from '../use-runner.ts'

// Parse command-line arguments
const args = process.argv.slice(2)
const config = {
  port: 0,
  cwd: '',
  colorScheme: 'light' as 'light' | 'dark',
  paths: [] as string[],
}

// Parse args: --port <num> --cwd <path> --color-scheme <light|dark> <paths...>
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (!arg) continue

  switch (arg) {
    case '--port':
    case '-p': {
      const portValue = args[++i]
      if (portValue) {
        config.port = Number.parseInt(portValue, 10)
      }
      break
    }
    case '--cwd':
    case '-d': {
      const cwdValue = args[++i]
      if (cwdValue) {
        config.cwd = cwdValue
      }
      break
    }
    case '--color-scheme': {
      const colorValue = args[++i]
      if (colorValue) {
        config.colorScheme = colorValue as 'light' | 'dark'
      }
      break
    }
    default:
      if (!arg.startsWith('-')) {
        config.paths.push(arg)
      }
  }
}

// Set default cwd if not provided
if (!config.cwd) {
  config.cwd = join(import.meta.dir, '.')
}

// Create a resolver for results
const { promise, resolve } = Promise.withResolvers<{
  passed: TestResult[]
  failed: TestResult[]
}>()

// Suppress console output except for final JSON
const originalLog = console.log
const originalError = console.error
console.log = () => {}
console.error = () => {}

try {
  // Initialize runner
  const trigger = await useRunner({
    port: config.port,
    cwd: config.cwd,
    colorScheme: config.colorScheme,
    paths: config.paths,
    reporter: resolve,
  })

  // Trigger test run
  trigger({ type: 'run' })

  // Wait for results with timeout (handles empty story case)
  const results = await Promise.race([
    promise,
    new Promise<{ passed: TestResult[]; failed: TestResult[] }>((resolve) => {
      setTimeout(() => {
        resolve({ passed: [], failed: [] })
      }, 5000) // 5 second timeout for empty results
    }),
  ])

  // Restore console and output JSON
  console.log = originalLog
  console.error = originalError

  // Output results as JSON
  console.log(JSON.stringify(results))

  // Exit with appropriate code
  process.exit(results.failed.length > 0 ? 1 : 0)
} catch (error) {
  // Restore console for error output
  console.log = originalLog
  console.error = originalError

  console.error('Error in runner harness:', error)
  process.exit(1)
}
