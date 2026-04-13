/**
 * Dynamically imported extension fixture for browser testing.
 * Served at a URL; the UI core `import()`s it via update_extension.
 */

import * as z from 'zod'
import { useExtension } from '../../../../behavioral.ts'
import { UI_CORE, UI_CORE_EVENTS } from '../../dom.constants.ts'

const UserActionSchema = (type: string) =>
  z.object({
    type: z.literal(type),
    event: z.unknown(),
  })

export const behavioralFixtureExtension = useExtension('behavioral_fixture', ({ bSync, bThread, extensions }) => {
  ;(globalThis as Record<string, unknown>).__behavioralModuleLoaded = true
  ;(globalThis as Record<string, unknown>).__handlerCalled = false
  ;(globalThis as Record<string, unknown>).__handlerCallCount = 0
  ;(globalThis as Record<string, unknown>).__scopedHandlerCalled = false
  ;(globalThis as Record<string, unknown>).__scopedHandlerCallCount = 0

  bThread({
    label: 'onTestClick',
    rules: [
      bSync({
        waitFor: extensions.block({
          extension: UI_CORE,
          event: UI_CORE_EVENTS.user_action,
          detailSchema: UserActionSchema('test_click'),
        }),
      }),
      bSync({
        request: {
          type: 'apply_test_click',
        },
      }),
    ],
    repeat: true,
  })

  bThread({
    label: 'onScopedTestClick',
    rules: [
      bSync({
        waitFor: extensions.block({
          extension: UI_CORE,
          event: UI_CORE_EVENTS.user_action,
          detailSchema: UserActionSchema('foo:test_click'),
        }),
      }),
      bSync({
        request: {
          type: 'apply_scoped_test_click',
        },
      }),
    ],
    repeat: true,
  })

  return {
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
  }
})
