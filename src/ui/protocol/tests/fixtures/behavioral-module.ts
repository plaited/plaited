/**
 * Dynamically imported behavioral module for browser testing.
 * Served at a URL; the controller `import()`s it via update_behavioral.
 *
 * Exports a useUIModule module that:
 * - Sets window.__behavioralModuleLoaded to confirm the module callback ran
 * - Declares explicit p-trigger action interest via action(schema)
 * - Routes external action events through a local handler event
 * - Uses a repeating bThread to verify install paths do not iterate generators
 */

import * as z from 'zod'
import { useUIModule } from '../../use-ui-module.ts'

const TestClickActionSchema = z.object({
  type: z.literal('test_click'),
  detail: z.unknown(),
})

const ApplyClickSchema = z.object({
  type: z.literal('apply_test_click'),
  detail: z.unknown(),
})

const ApplyScopedClickSchema = z.object({
  type: z.literal('apply_scoped_test_click'),
  detail: z.unknown(),
})

const moduleFactory = useUIModule('behavioral_fixture', ({ action, local, bSync, bThread }) => {
  const testClick = action(TestClickActionSchema)
  const applyClick = local(ApplyClickSchema)
  const scopedTestClick = action(TestClickActionSchema, 'foo')
  const applyScopedClick = local(ApplyScopedClickSchema)

  ;(globalThis as Record<string, unknown>).__behavioralModuleLoaded = true
  ;(globalThis as Record<string, unknown>).__handlerCalled = false
  ;(globalThis as Record<string, unknown>).__handlerCallCount = 0
  ;(globalThis as Record<string, unknown>).__scopedHandlerCalled = false
  ;(globalThis as Record<string, unknown>).__scopedHandlerCallCount = 0
  return {
    threads: {
      test_thread: bThread(
        [
          bSync({
            waitFor: testClick.on(z.literal('trigger')),
          }),
          bSync({
            request: applyClick.request(),
          }),
        ],
        true,
      ),
      scoped_test_thread: bThread(
        [
          bSync({
            waitFor: scopedTestClick.on(z.literal('trigger')),
          }),
          bSync({
            request: applyScopedClick.request(),
          }),
        ],
        true,
      ),
    },
    handlers: {
      apply_test_click() {
        ;(globalThis as Record<string, unknown>).__handlerCalled = true
        ;(globalThis as Record<string, unknown>).__handlerCallCount =
          Number((globalThis as Record<string, unknown>).__handlerCallCount ?? 0) + 1
      },
      apply_scoped_test_click() {
        ;(globalThis as Record<string, unknown>).__scopedHandlerCalled = true
        ;(globalThis as Record<string, unknown>).__scopedHandlerCallCount =
          Number((globalThis as Record<string, unknown>).__scopedHandlerCallCount ?? 0) + 1
      },
    },
  }
})

export default moduleFactory
