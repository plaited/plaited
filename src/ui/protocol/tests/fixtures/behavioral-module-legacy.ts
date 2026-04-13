/**
 * Legacy update_behavioral module fixture.
 *
 * @remarks
 * This intentionally uses the raw `(trigger) => result` contract and declares
 * explicit `actions` metadata for local p-trigger routing compatibility.
 */

import * as z from 'zod'
import { bSync, bThread } from '../../../../behavioral.ts'

const onType = (type: string) => ({
  type,
  sourceSchema: z.enum(['trigger', 'request', 'emit']),
  detailSchema: z.unknown(),
})

const legacyFactory = (_trigger: (event: { type: string; detail?: unknown }) => void) => {
  ;(globalThis as Record<string, unknown>).__legacyBehavioralModuleLoaded = true
  ;(globalThis as Record<string, unknown>).__legacyHandlerCalled = false
  ;(globalThis as Record<string, unknown>).__legacyHandlerCallCount = 0
  return {
    actions: ['legacy_click'],
    threads: {
      legacy_thread: bThread(
        [
          bSync({
            waitFor: onType('legacy_click'),
          }),
          bSync({
            request: {
              type: 'legacy_apply_click',
            },
          }),
        ],
        true,
      ),
    },
    handlers: {
      legacy_apply_click() {
        ;(globalThis as Record<string, unknown>).__legacyHandlerCalled = true
        ;(globalThis as Record<string, unknown>).__legacyHandlerCallCount =
          Number((globalThis as Record<string, unknown>).__legacyHandlerCallCount ?? 0) + 1
      },
    },
  }
}

export default legacyFactory
