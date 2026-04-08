/**
 * Dynamically imported behavioral module for browser testing.
 * Served at a URL; the controller `import()`s it via update_behavioral.
 *
 * Exports a factory that:
 * - Sets window.__behavioralModuleLoaded to confirm the factory ran
 * - Returns threads (via bThread/bSync) and handlers
 */

import * as z from 'zod'
import { bSync, bThread } from '../../../../behavioral.ts'

const onType = (type: string) => ({
  kind: 'match' as const,
  type,
  sourceSchema: z.enum(['trigger', 'request', 'emit']),
  detailSchema: z.unknown(),
})

const factory = (_trigger: (event: { type: string; detail?: unknown }) => void) => {
  ;(globalThis as Record<string, unknown>).__behavioralModuleLoaded = true
  return {
    threads: {
      test_thread: bThread([bSync({ waitFor: onType('test_trigger') })]),
    },
    handlers: {
      test_handler() {
        ;(globalThis as Record<string, unknown>).__handlerCalled = true
      },
    },
  }
}

export default factory
