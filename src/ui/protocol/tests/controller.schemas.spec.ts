import { describe, expect, test } from 'bun:test'
import { CONTROLLER_EVENTS, SWAP_MODES } from '../controller.constants.ts'
import {
  AttrsMessageSchema,
  ClientConnectedMessageSchema,
  DisconnectMessageSchema,
  RenderMessageSchema,
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
  test('accepts valid user action message with { id, source, msg } envelope', () => {
    const msg = {
      type: CONTROLLER_EVENTS.user_action,
      detail: { id: 'abc123', source: 'test-island', msg: 'click_button' },
    }
    expect(UserActionMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects detail without id', () => {
    expect(() =>
      UserActionMessageSchema.parse({
        type: CONTROLLER_EVENTS.user_action,
        detail: { source: 'test-island', msg: 'click' },
      }),
    ).toThrow()
  })

  test('rejects detail without source', () => {
    expect(() =>
      UserActionMessageSchema.parse({
        type: CONTROLLER_EVENTS.user_action,
        detail: { id: 'abc123', msg: 'click' },
      }),
    ).toThrow()
  })

  test('rejects detail without msg', () => {
    expect(() =>
      UserActionMessageSchema.parse({
        type: CONTROLLER_EVENTS.user_action,
        detail: { id: 'abc123', source: 'test-island' },
      }),
    ).toThrow()
  })

  test('rejects flat string detail (old format)', () => {
    expect(() =>
      UserActionMessageSchema.parse({
        type: CONTROLLER_EVENTS.user_action,
        detail: 'click_button',
      }),
    ).toThrow()
  })
})

describe('ClientConnectedMessageSchema', () => {
  test('accepts valid client_connected message with { id, source, msg } envelope', () => {
    const msg = {
      type: CONTROLLER_EVENTS.client_connected,
      detail: { id: 'abc123', source: 'test-island', msg: 'connected' as const },
    }
    expect(ClientConnectedMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts document as source value', () => {
    const msg = {
      type: CONTROLLER_EVENTS.client_connected,
      detail: { id: 'def456', source: 'document', msg: 'connected' as const },
    }
    expect(ClientConnectedMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects detail without source', () => {
    expect(() =>
      ClientConnectedMessageSchema.parse({
        type: CONTROLLER_EVENTS.client_connected,
        detail: { id: 'abc123', msg: 'connected' },
      }),
    ).toThrow()
  })

  test('rejects msg other than connected', () => {
    expect(() =>
      ClientConnectedMessageSchema.parse({
        type: CONTROLLER_EVENTS.client_connected,
        detail: { id: 'abc123', source: 'test-island', msg: 'test-island' },
      }),
    ).toThrow()
  })

  test('rejects flat string detail (old format)', () => {
    expect(() =>
      ClientConnectedMessageSchema.parse({
        type: CONTROLLER_EVENTS.client_connected,
        detail: 'test-island',
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

describe('SnapshotEventSchema', () => {
  test('accepts valid snapshot event with { id, source, msg } envelope', () => {
    const msg = {
      type: CONTROLLER_EVENTS.snapshot,
      detail: {
        id: 'abc123',
        source: 'test-island',
        msg: {
          kind: 'selection' as const,
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
      },
    }
    expect(SnapshotEventSchema.parse(msg)).toEqual(msg)
  })

  test('accepts snapshot with feedback_error kind', () => {
    const msg = {
      type: CONTROLLER_EVENTS.snapshot,
      detail: {
        id: 'def456',
        source: 'document',
        msg: {
          kind: 'feedback_error' as const,
          type: 'some_event',
          error: 'handler threw',
        },
      },
    }
    expect(SnapshotEventSchema.parse(msg)).toEqual(msg)
  })

  test('rejects detail without id', () => {
    expect(() =>
      SnapshotEventSchema.parse({
        type: CONTROLLER_EVENTS.snapshot,
        detail: {
          source: 'test-island',
          msg: {
            kind: 'selection' as const,
            bids: [],
          },
        },
      }),
    ).toThrow()
  })

  test('rejects detail without source', () => {
    expect(() =>
      SnapshotEventSchema.parse({
        type: CONTROLLER_EVENTS.snapshot,
        detail: {
          id: 'abc123',
          msg: {
            kind: 'selection' as const,
            bids: [],
          },
        },
      }),
    ).toThrow()
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
    const rulesFunction = Object.assign(function* () {}, { $: '🪢' } as const)
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
