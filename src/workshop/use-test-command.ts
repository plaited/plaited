import type { BrowserContextOptions } from 'playwright'
import { checkPlaywright } from './check-playwright.ts'
import { useRunner } from './use-runner.ts'

export const useTestCommand = async ({
  cwd,
  port = 0,
  colorScheme = 'light',
  paths,
  recordVideo,
}: {
  cwd: string
  port?: number
  colorScheme?: 'light' | 'dark' | 'both'
  paths: string[]
  recordVideo?: BrowserContextOptions['recordVideo']
}) => {
  // Check for Playwright installation before proceeding
  console.log('🔍 Checking Playwright installation...')
  const playwrightReady = await checkPlaywright(cwd)

  if (!playwrightReady) {
    console.error('\n🚩 Cannot run tests without Playwright')
    process.exit(1)
  }

  console.log('✅ Playwright is ready\n')

  // Determine which color schemes to run
  const schemes: Array<'light' | 'dark'> = colorScheme === 'both' ? ['light', 'dark'] : [colorScheme]

  for (const scheme of schemes) {
    if (colorScheme === 'both') {
      console.log(`\n🎨 Running tests with ${scheme} color scheme...\n`)
    }

    // Initialize test runner (this creates and starts the server)
    console.log('🔧 Initializing test runner...')
    const runner = await useRunner({
      port,
      cwd,
      paths,
      colorScheme: scheme,
      recordVideo,
    })
    // Wait for results
    runner({
      type: 'run',
    })

    // If running both schemes, wait for the first run to complete before starting the second
    if (colorScheme === 'both' && scheme === 'light') {
      // The runner handles its own exit, so we need to wait
      // For now, this sequential approach works because useRunner exits the process
      // In the future, we may want to refactor useRunner to return results instead of exiting
    }
  }
}
