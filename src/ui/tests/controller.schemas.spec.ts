import { describe, expect, test } from 'bun:test'
import { CONTROLLER_EVENTS, SWAP_MODES } from '../controller.constants.ts'
import {
  AttrsMessageSchema,
  BehavioralUpdatedMessageSchema,
  DisconnectMessageSchema,
  RenderMessageSchema,
  RootConnectedMessageSchema,
  SnapshotEventSchema,
  SwapModeSchema,
  UpdateBehavioralModuleSchema,
  UpdateBehavioralResultSchema,
  UserActionMessageSchema,
} from '../controller.schemas.ts'

describe('SwapModeSchema', () => {
  test('accepts all valid swap modes', () => {
    for (const mode of Object.values(SWAP_MODES)) {
      expect(SwapModeSchema.parse(mode)).toBe(mode)
    }
  })

  test('rejects invalid swap mode', () => {
    expect(() => SwapModeSchema.parse('replace')).toThrow()
  })
})

describe('RenderMessageSchema', () => {
  test('accepts valid render message with swap', () => {
    const msg = {
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<div>hello</div>', swap: SWAP_MODES.innerHTML },
    }
    expect(RenderMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts render message without swap (optional)', () => {
    const msg = {
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<p>content</p>' },
    }
    expect(RenderMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects render message with wrong type', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: 'wrong',
        detail: { target: 'main', html: '<div/>' },
      }),
    ).toThrow()
  })

  test('rejects render message missing target', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: CONTROLLER_EVENTS.render,
        detail: { html: '<div/>' },
      }),
    ).toThrow()
  })

  test('rejects render message missing html', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: CONTROLLER_EVENTS.render,
        detail: { target: 'main' },
      }),
    ).toThrow()
  })
})

describe('AttrsMessageSchema', () => {
  test('accepts valid attrs message with string value', () => {
    const msg = {
      type: CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { class: 'active' } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with null value (remove)', () => {
    const msg = {
      type: CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { class: null } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with number value', () => {
    const msg = {
      type: CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { tabindex: 0 } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with boolean value', () => {
    const msg = {
      type: CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { disabled: true } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects attrs with wrong type', () => {
    expect(() =>
      AttrsMessageSchema.parse({
        type: 'wrong',
        detail: { target: 'main', attr: {} },
      }),
    ).toThrow()
  })
})

describe('UserActionMessageSchema', () => {
  test('accepts valid user action message', () => {
    const msg = { type: CONTROLLER_EVENTS.user_action, detail: 'click_button' }
    expect(UserActionMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects non-string detail', () => {
    expect(() =>
      UserActionMessageSchema.parse({
        type: CONTROLLER_EVENTS.user_action,
        detail: { nested: true },
      }),
    ).toThrow()
  })
})

describe('RootConnectedMessageSchema', () => {
  test('accepts valid root_connected message', () => {
    const msg = { type: CONTROLLER_EVENTS.root_connected, detail: 'test-island' }
    expect(RootConnectedMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts document as detail', () => {
    const msg = { type: CONTROLLER_EVENTS.root_connected, detail: 'document' }
    expect(RootConnectedMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects non-string detail', () => {
    expect(() =>
      RootConnectedMessageSchema.parse({
        type: CONTROLLER_EVENTS.root_connected,
        detail: 42,
      }),
    ).toThrow()
  })
})

describe('DisconnectMessageSchema', () => {
  test('accepts disconnect message without detail', () => {
    const msg = { type: CONTROLLER_EVENTS.disconnect }
    expect(DisconnectMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts disconnect message with undefined detail', () => {
    const msg = { type: CONTROLLER_EVENTS.disconnect, detail: undefined }
    expect(DisconnectMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects disconnect with non-undefined detail', () => {
    expect(() =>
      DisconnectMessageSchema.parse({
        type: CONTROLLER_EVENTS.disconnect,
        detail: 'something',
      }),
    ).toThrow()
  })
})

describe('BehavioralUpdatedMessageSchema', () => {
  test('accepts valid behavioral_updated message', () => {
    const msg = {
      type: CONTROLLER_EVENTS.behavioral_updated,
      detail: {
        src: 'https://example.com/module.js',
        threads: ['thread1', 'thread2'],
        handlers: ['handler1'],
      },
    }
    expect(BehavioralUpdatedMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts message with optional fields omitted', () => {
    const msg = {
      type: CONTROLLER_EVENTS.behavioral_updated,
      detail: { src: 'https://example.com/module.js' },
    }
    expect(BehavioralUpdatedMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects non-URL src', () => {
    expect(() =>
      BehavioralUpdatedMessageSchema.parse({
        type: CONTROLLER_EVENTS.behavioral_updated,
        detail: { src: 'not-a-url' },
      }),
    ).toThrow()
  })
})

describe('SnapshotEventSchema', () => {
  test('accepts valid snapshot event with selection kind', () => {
    const msg = {
      type: CONTROLLER_EVENTS.snapshot,
      detail: {
        kind: 'selection',
        bids: [
          {
            thread: 'test',
            trigger: false,
            selected: true,
            type: 'event',
            priority: 0,
          },
        ],
      },
    }
    expect(SnapshotEventSchema.parse(msg)).toEqual(msg)
  })

  test('accepts snapshot with feedback_error kind', () => {
    const msg = {
      type: CONTROLLER_EVENTS.snapshot,
      detail: {
        kind: 'feedback_error',
        type: 'some_event',
        error: 'handler threw',
      },
    }
    expect(SnapshotEventSchema.parse(msg)).toEqual(msg)
  })
})

describe('UpdateBehavioralResultSchema', () => {
  test('accepts object with handlers (sync and async functions)', () => {
    const result = {
      handlers: {
        on_click: () => {},
        on_submit: async () => {},
      },
    }
    expect(UpdateBehavioralResultSchema.parse(result)).toEqual(result)
  })

  test('accepts empty object (both optional)', () => {
    expect(UpdateBehavioralResultSchema.parse({})).toEqual({})
  })

  test('rejects handlers with non-function values', () => {
    expect(() =>
      UpdateBehavioralResultSchema.parse({
        handlers: { on_click: 'not a function' },
      }),
    ).toThrow()
  })

  test('rejects threads with plain functions (not RulesFunction)', () => {
    // A plain function without the RulesFunction shape is rejected
    expect(() =>
      UpdateBehavioralResultSchema.parse({
        threads: { myThread: () => {} },
      }),
    ).toThrow()
  })

  test('accepts threads with real bThread/bSync output (generator function with $ identifier)', () => {
    const rulesFunction = Object.assign(function* () {}, { $: '🪢' })
    const result = UpdateBehavioralResultSchema.parse({
      threads: { myThread: rulesFunction },
    })
    expect(result.threads).toBeDefined()
    expect(result.threads!.myThread).toBe(rulesFunction)
  })
})

describe('UpdateBehavioralModuleSchema', () => {
  test('accepts module with default export function', () => {
    const mod = { default: () => ({ threads: {}, handlers: {} }) }
    expect(UpdateBehavioralModuleSchema.parse(mod)).toEqual(mod)
  })

  test('rejects module with non-function default', () => {
    expect(() => UpdateBehavioralModuleSchema.parse({ default: 'not a function' })).toThrow()
  })

  test('rejects module without default export', () => {
    expect(() => UpdateBehavioralModuleSchema.parse({})).toThrow()
  })
})
