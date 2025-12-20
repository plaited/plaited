import { checkPlaywright } from './check-playwright.ts'
import { useRunner } from './use-runner.ts'

export const useTestCommand = async ({
  cwd,
  port = 0,
  colorScheme = 'light',
  paths,
}: {
  cwd: string
  port?: number
  colorScheme?: 'light' | 'dark'
  paths: string[]
}) => {
  // Check for Playwright installation before proceeding
  console.log('🔍 Checking Playwright installation...')
  const playwrightReady = await checkPlaywright(cwd)

  if (!playwrightReady) {
    console.error('\n🚩 Cannot run tests without Playwright')
    process.exit(1)
  }

  console.log('✅ Playwright is ready\n')

  // Initialize test runner (this creates and starts the server)
  console.log('🔧 Initializing test runner...')
  const runner = await useRunner({
    port,
    cwd,
    paths,
    colorScheme,
  })
  // Wait for results
  runner({
    type: 'run',
  })
}
