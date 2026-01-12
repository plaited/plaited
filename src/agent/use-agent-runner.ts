/**
 * Agent runner for story test execution with hot reload support.
 *
 * @remarks
 * Spawns a dev server subprocess with `--hot` and uses Playwright to exercise stories.
 * Designed for training workflows that need:
 * - Hot reload when agent writes new files
 * - Multiple test runs without server restart
 * - Full trajectory data via IPC
 *
 * Unlike `useRunner` which calls `getServer()` directly, `useAgentRunner`:
 * - Spawns `useDevCommand` as subprocess with IPC
 * - Hot reload "just works" via `bun --hot`
 * - Results flow: Browser → WebSocket → Server → IPC → trigger
 */

import { availableParallelism } from 'node:os'
import { basename, resolve } from 'node:path'
import { type BrowserContext, chromium } from 'playwright'
import { useBehavioral } from '../main.ts'
import { ERROR_TYPES, FIXTURE_EVENTS } from '../testing/testing.constants.ts'
import type { FailMessage, PassMessage, RunnerMessage } from '../testing.ts'
import type { InspectorMessageDetail } from '../ui/b-element.types.ts'
import { INSPECTOR_MESSAGE } from '../ui/inspector.ts'
import type { HotReloadMessage, ServerReadyMessage, StoriesMessage, StoryMetadata } from '../workshop/workshop.types.ts'
import { splitIntoBatches } from '../workshop/workshop.utils.ts'
import type { StoryResult } from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for useAgentRunner.
 */
export type AgentRunnerConfig = {
  /** Current working directory (project root) */
  cwd: string
  /** Directories to search for stories */
  paths: string[]
  /** Server port (0 for auto-assign) */
  port?: number
  /** Color scheme for story rendering */
  colorScheme?: 'light' | 'dark'
  /** Callback when test run completes with results */
  onComplete?: (results: { passed: AgentTestResult[]; failed: AgentTestResult[] }) => void
}

/**
 * IPC messages from dev server.
 */
type ServerToAgentMessage = ServerReadyMessage | HotReloadMessage | StoriesMessage | RunnerMessage

/**
 * Test result for a single story with trajectory data.
 */
export type AgentTestResult = {
  story: StoryMetadata
  passed: boolean
  error?: unknown
  /** Inspector snapshots captured during story execution */
  snapshots: InspectorMessageDetail[]
}

// ============================================================================
// Agent Runner
// ============================================================================

/**
 * Creates an agent runner for story test execution with hot reload.
 *
 * @remarks
 * Spawns `bun --hot plaited dev` as subprocess and uses Playwright to run tests.
 * The dev server handles hot reload automatically when files change.
 *
 * @example
 * ```typescript
 * const trigger = await useAgentRunner({
 *   cwd: process.cwd(),
 *   paths: ['training/stories'],
 * })
 *
 * // Run all story tests
 * trigger({ type: 'run' })
 * ```
 */
export const useAgentRunner = useBehavioral<
  {
    [FIXTURE_EVENTS.test_pass]: PassMessage['detail']
    [FIXTURE_EVENTS.test_fail]: FailMessage['detail']
  },
  AgentRunnerConfig
>({
  publicEvents: ['run'],

  async bProgram({ cwd, paths, port = 0, colorScheme = 'light', onComplete, trigger, bThreads, bThread, bSync }) {
    let failed: AgentTestResult[] = []
    let passed: AgentTestResult[] = []
    let serverPort = 0
    let stories = new Map<string, StoryMetadata>()
    const contextRefs = new Map<string, BrowserContext>()
    // Track inspector snapshots per active test (keyed by element tag)
    const activeSnapshots = new Map<string, InspectorMessageDetail[]>()

    // Resolve CLI path
    const cliPath = resolve(import.meta.dir, '..', 'cli.ts')

    // Spawn dev server with hot reload and IPC
    const proc = Bun.spawn(['bun', '--hot', cliPath, 'dev', ...paths, '-p', String(port), '-c', colorScheme], {
      cwd,
      stdout: 'inherit',
      stderr: 'inherit',
      ipc(message) {
        const msg = message as ServerToAgentMessage

        switch (msg.type) {
          case 'server-ready':
            serverPort = msg.detail.port
            trigger({ type: 'server-ready', detail: msg.detail })
            break

          case 'stories':
            // Update stories map
            stories = new Map(msg.detail.map((s) => [s.route, s]))
            trigger({ type: 'stories-received', detail: { count: stories.size } })
            break

          case 'hot-reload':
            // Update stories from hot reload
            stories = new Map(msg.detail.stories.map((s) => [s.route, s]))
            trigger({ type: 'hot-reload', detail: { count: stories.size } })
            break

          case FIXTURE_EVENTS.test_pass:
          case FIXTURE_EVENTS.test_fail:
            // Forward test results to trigger
            trigger(msg)
            break

          case INSPECTOR_MESSAGE: {
            // Capture inspector snapshots for trajectory data
            const detail = msg.detail as InspectorMessageDetail
            const existing = activeSnapshots.get(detail.element) ?? []
            existing.push(detail)
            activeSnapshots.set(detail.element, existing)
            break
          }
        }
      },
    })

    // Wait for server to be ready before launching browser
    const { promise: serverReady, resolve: resolveServerReady } = Promise.withResolvers<void>()

    bThreads.set({
      waitForServer: bThread([bSync({ waitFor: 'server-ready' }), bSync({ request: { type: 'launch-browser' } })]),

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
          bSync({ request: { type: 'run-complete' } }),
        ],
        true,
      ),
    })

    // Launch browser
    console.info('[agent-runner] Launching browser...')
    const browser = await chromium.launch()

    // Handle SIGINT
    process.on('SIGINT', () => {
      console.info('\n[agent-runner] Interrupted by user')
      trigger({ type: 'interrupt' })
    })

    const cleanup = async () => {
      passed = []
      failed = []
      try {
        console.info('[agent-runner] Cleaning up...')
        proc.kill()
        await browser.close()
        contextRefs.clear()
        stories.clear()
      } catch (error) {
        console.error('[agent-runner] Error during cleanup:', error)
      }
    }

    const formatErrorType = (errorType: string) => {
      switch (errorType) {
        case ERROR_TYPES.accessibility_violation:
          return '🔴 Accessibility Violation'
        case ERROR_TYPES.failed_assertion:
          return '🔴 Failed Assertion'
        case ERROR_TYPES.test_timeout:
          return '🔴 Timeout'
        default:
          return `🔴 ${errorType}`
      }
    }

    return {
      'server-ready'() {
        resolveServerReady()
        // Request stories list
        proc.send({ type: 'get-stories' })
      },

      'stories-received'() {
        console.info(`[agent-runner] Received ${stories.size} stories`)
      },

      'hot-reload'() {
        console.info(`[agent-runner] Hot reload: ${stories.size} stories`)
      },

      async [FIXTURE_EVENTS.test_pass]({ pathname }) {
        if (stories.has(pathname)) {
          console.info(`[agent-runner] ✅ ${basename(pathname)}`)
          // Collect ALL snapshots from ALL elements for complete trajectory
          const allSnapshots: InspectorMessageDetail[] = []
          for (const snapshots of activeSnapshots.values()) {
            allSnapshots.push(...snapshots)
          }
          passed.push({
            story: stories.get(pathname)!,
            passed: true,
            snapshots: allSnapshots,
          })
          // Clear for next test
          activeSnapshots.clear()
        }
        // Close context (unlike use-runner which relies on browser.close() in end handler)
        const context = contextRefs.get(pathname)
        if (context) {
          await context.close()
          contextRefs.delete(pathname)
        }
      },

      async [FIXTURE_EVENTS.test_fail](detail) {
        const { pathname } = detail
        if (stories.has(pathname)) {
          console.info(`[agent-runner] ❌ ${basename(pathname)} (${formatErrorType(detail.errorType)})`)
          // Collect ALL snapshots from ALL elements for complete trajectory
          const allSnapshots: InspectorMessageDetail[] = []
          for (const snapshots of activeSnapshots.values()) {
            allSnapshots.push(...snapshots)
          }
          failed.push({
            story: stories.get(pathname)!,
            passed: false,
            error: detail,
            snapshots: allSnapshots,
          })
          // Clear for next test
          activeSnapshots.clear()
        }
        // Close context (unlike use-runner which relies on browser.close() in end handler)
        const context = contextRefs.get(pathname)
        if (context) {
          await context.close()
          contextRefs.delete(pathname)
        }
      },

      'run-complete'() {
        // Call onComplete callback with results
        onComplete?.({ passed: [...passed], failed: [...failed] })
        // Clear arrays for next run
        passed = []
        failed = []
      },

      async interrupt() {
        await cleanup()
        process.exit(130)
      },

      async run() {
        // Wait for server to be ready
        await serverReady

        if (stories.size === 0) {
          console.info('[agent-runner] No stories found')
          return
        }

        // Reset results
        passed = []
        failed = []

        try {
          const batches = splitIntoBatches([...stories.values()], availableParallelism())
          console.info(`[agent-runner] Running ${stories.size} tests...\n`)

          for (const batch of batches) {
            await Promise.all(
              batch.map(async (story) => {
                const context = await browser.newContext({
                  colorScheme,
                  baseURL: `http://localhost:${serverPort}`,
                })

                const page = await context.newPage()

                try {
                  await page.addInitScript(() => {
                    window.__PLAITED_RUNNER__ = true
                  })

                  await page.goto(story.route)
                  contextRefs.set(story.route, context)
                } catch (error) {
                  console.error(`[agent-runner] Error executing ${story.exportName}:`, error)

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
          console.error('[agent-runner] Error during test execution:', error)
        }
      },
    }
  },
})

// ============================================================================
// Helper: Convert test results to StoryResult
// ============================================================================

/**
 * Convert agent test results to StoryResult for training.
 *
 * @param results - Array of agent test results
 * @returns StoryResult compatible with training utilities
 */
export const toStoryResult = (results: { passed: AgentTestResult[]; failed: AgentTestResult[] }): StoryResult => {
  const total = results.passed.length + results.failed.length
  const passedCount = results.passed.length

  // Check for accessibility errors in failures
  const a11yFailed = results.failed.some((r) => {
    const detail = r.error as { errorType?: string } | undefined
    return detail?.errorType === ERROR_TYPES.accessibility_violation
  })

  return {
    passed: results.failed.length === 0,
    a11yPassed: !a11yFailed,
    totalAssertions: total,
    passedAssertions: passedCount,
    errors: results.failed.map((r) => {
      const detail = r.error as { error?: string } | undefined
      return detail?.error ?? 'Unknown error'
    }),
  }
}
