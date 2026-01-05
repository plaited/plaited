/**
 * @internal
 * Test runner for Plaited story tests with Playwright.
 * Manages browser contexts, test execution, and result reporting.
 */
import { availableParallelism } from 'node:os'
import { basename } from 'node:path'
import { type BrowserContext, type BrowserContextOptions, chromium } from 'playwright'
import { useBehavioral } from '../main.ts'
import { ERROR_TYPES, FIXTURE_EVENTS } from '../testing/testing.constants.ts'
import type { FailMessage, PassMessage } from '../testing.ts'
import { getServer } from './get-server.ts'
import type { StoryMetadata } from './workshop.types.ts'
import { formatErrorType, splitIntoBatches } from './workshop.utils.ts'

/**
 * @internal
 * Test result structure for individual story tests.
 */
export type TestResult = {
  story: StoryMetadata
  passed: boolean
  error?: unknown
}

/**
 * @internal
 * Output structure for test runner results.
 */
export type TestStoriesOutput = {
  passed: number
  failed: number
  total: number
  results: TestResult[]
}

const logResults = (results: { total: number; passed: number; failed: number }) => {
  // Print summary
  console.log(`\n${'='.repeat(50)}`)
  console.log('📊 Test Summary')
  console.log('='.repeat(50))
  console.log(`Total:  ${results.total}`)
  console.log(`Passed: ${results.passed} ✅`)
  console.log(`Failed: ${results.failed} 🚩`)
  console.log('='.repeat(50))
}
/**
 * Creates a test runner for running Plaited story tests.
 * Manages server lifecycle, test execution, and result reporting.
 *
 * @param browser - Playwright browser instance
 * @param port - Port number for the test server
 * @param recordVideo - Optional video recording configuration
 * @param reporter - Callback function to report test results
 * @param cwd - Working directory for story discovery
 *
 * @returns Object with methods for controlling test execution
 *
 * @remarks
 * - Server is created at initialization and reused
 * - Test discovery happens on each run call
 * - Results are reported via the reporter callback
 * - Cleanup happens on end call
 *
 * @see {@link getServer} for server creation
 * @see {@link discoverStoryMetadata} for story discovery
 */
export const useRunner = useBehavioral<
  {
    [FIXTURE_EVENTS.test_pass]: PassMessage['detail']
    [FIXTURE_EVENTS.test_fail]: FailMessage['detail']
  },
  {
    port: number
    recordVideo?: BrowserContextOptions['recordVideo']
    cwd: string
    colorScheme?: 'light' | 'dark'
    paths: string[]
    reporter?: (args: { passed: TestResult[]; failed: TestResult[] }) => void
  }
>({
  publicEvents: ['run'],
  async bProgram({
    port,
    recordVideo,
    cwd,
    trigger,
    colorScheme = 'light',
    paths,
    bThreads,
    bThread,
    bSync,
    reporter,
  }) {
    let failed: TestResult[] = []
    let passed: TestResult[] = []
    const contextRefs = new Map<string, BrowserContext>()
    // Create server at initialization
    const { server, stories } = await getServer({ cwd, port, paths, trigger, colorScheme })
    // Launch browser
    console.log('🌐 Launching browser...')
    const browser = await chromium.launch()
    bThreads.set({
      onCountChange: bThread(
        [
          bSync({
            waitFor: ({ type }) => {
              const events = [FIXTURE_EVENTS.test_fail, FIXTURE_EVENTS.test_pass]
              if (!events.includes(type as (typeof events)[number])) return false
              const completedRuns = failed.length + passed.length
              const runsLeft = stories.size - completedRuns
              return runsLeft === 1
            },
          }),
          bSync({ request: { type: 'report' } }),
          bSync({ request: { type: 'end' } }),
        ],
        true,
      ),
    })

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('\n⚠️  Interrupted by user')
      trigger({ type: 'interrupt' })
    })

    const cleanup = async () => {
      passed = []
      failed = []
      try {
        console.log('\n🧹 Cleaning up...')
        console.log('🛑 Shutting down test runner')
        await server.stop(true)
        await browser.close()
        contextRefs.clear()
        stories.clear()
      } catch (error) {
        console.error('Error during cleanup:', error)
      }
    }
    return {
      async end() {
        if (failed.length > 0) {
          await cleanup()
          process.exit(1)
        } else {
          await cleanup()
          process.exit(0)
        }
      },
      async interrupt() {
        await cleanup()
        process.exit(130)
      },
      async [FIXTURE_EVENTS.test_pass]({ pathname }) {
        if (stories.has(pathname)) {
          console.log(`🟢 ${basename(pathname)}`)
          passed.push({
            story: stories.get(pathname)!,
            passed: true,
          })
        }
        contextRefs.delete(pathname)
      },
      async [FIXTURE_EVENTS.test_fail](detail) {
        const { pathname } = detail
        if (stories.has(pathname)) {
          console.log(`🔴 ${basename(pathname)} (${formatErrorType(detail.errorType)})`)
          failed.push({
            story: stories.get(pathname)!,
            passed: false,
            error: detail,
          })
        }
        contextRefs.delete(detail.pathname)
      },
      report() {
        const passedCount = passed.length
        const failedCount = failed.length

        reporter?.({
          passed,
          failed,
        })

        // Print summary with detailed failures
        if (failedCount > 0) {
          console.log(`\n ${'='.repeat(50)}`)
          console.log(`\n${failed.length} Failed Test${failed.length > 1 ? 's' : ''}:\n`)

          failed.forEach(({ story, error }, index, arr) => {
            const detail = error as { errorType: string; error: string }

            const formattedErrorType = formatErrorType(detail.errorType)

            console.log(`ExportName: ${story.exportName}`)
            console.log(`File: ${`.${story.filePath.replace(cwd, '')}`}`)
            console.log('')
            console.log(`${detail.error.replace(`${detail.errorType}`, formattedErrorType)}`)
            console.log('')
            console.log(`Route: http://localhost${story.route}`)
            console.log(`ColorScheme: ${colorScheme}`)
            console.log('')
            const length = arr.length
            if (length > 1 && index + 1 < length) {
              console.log('-'.repeat(50))
              console.log('')
            }
          })
          console.log('='.repeat(50))
        }

        // Print summary
        console.log(`\n${'='.repeat(50)}`)
        console.log('📊 Test Summary')
        console.log('='.repeat(50))
        console.log(`Total:  ${passedCount + failedCount}`)
        console.log(`Passed: ${passedCount} ✅`)
        console.log(`Failed: ${failedCount} 🚩`)
        console.log('='.repeat(50))
      },
      async run() {
        if (stories.size === 0) {
          logResults({
            passed: 0,
            failed: 0,
            total: 0,
          })
        }

        // Create browser context with colorScheme
        // Modify recordVideo directory to include colorScheme subdirectory
        const videoConfig = recordVideo
          ? {
              ...recordVideo,
              dir: `${recordVideo.dir}/${colorScheme}`,
            }
          : undefined

        try {
          const batches = splitIntoBatches([...stories.values()], availableParallelism())
          console.log('🚀 Running tests...\n')
          for (const stories of batches) {
            await Promise.all(
              stories.map(async (story) => {
                const context = await browser.newContext({
                  recordVideo: videoConfig,
                  colorScheme,
                  baseURL: server.url.href,
                })

                const page = await context.newPage()

                try {
                  await page.addInitScript(() => {
                    window.__PLAITED_RUNNER__ = true
                  })

                  await page.goto(story.route)

                  contextRefs.set(story.route, context)
                } catch (error) {
                  console.error(`Error executing story ${story.exportName}:`, error)

                  trigger({
                    type: FIXTURE_EVENTS.test_fail,
                    detail: {
                      pathname: story.route,
                      errorType: ERROR_TYPES.unknown_error,
                      error: error instanceof Error ? error.message : String(error),
                    },
                  })
                }
              }),
            )
          }
        } catch (error) {
          console.error('Error during test execution:', error)
        }
      },
    }
  },
})
