import { describe, expect, test } from 'bun:test'

import { AGENT_TO_CONTROLLER_EVENTS } from '../../../bridge-events.ts'
import { CONTROLLER_TO_AGENT_EVENTS, SWAP_MODES } from '../controller.constants.ts'
import {
  AttrsMessageSchema,
  ClientMessageSchema,
  ControllerErrorMessageSchema,
  ControllerModuleDefaultSchema,
  ImportModuleSchema,
  RenderMessageSchema,
  SwapModeSchema,
  UiEventMessageSchema,
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
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<div>hello</div>', swap: SWAP_MODES.innerHTML },
    }
    expect(RenderMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts render message without swap (optional)', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
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
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { html: '<div/>' },
      }),
    ).toThrow()
  })

  test('rejects render message missing html', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { target: 'main' },
      }),
    ).toThrow()
  })

  test('rejects render message with invalid swap mode', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { target: 'main', html: '<div/>', swap: 'replace' },
      }),
    ).toThrow()
  })
})

describe('AttrsMessageSchema', () => {
  test('accepts valid attrs message with string value', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { class: 'active' } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with null value (remove)', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { class: null } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with number value', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { tabindex: 0 } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with boolean value', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
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

  test('rejects attrs with non-primitive values', () => {
    expect(() =>
      AttrsMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.attrs,
        detail: { target: 'main', attr: { dataset: { nested: true } } },
      }),
    ).toThrow()
  })
})

describe('ImportModuleSchema', () => {
  test('accepts import messages with site-root JavaScript path detail', () => {
    const message = {
      type: AGENT_TO_CONTROLLER_EVENTS.import,
      detail: '/dist/modules/controller-module.js',
    }
    expect(ImportModuleSchema.parse(message)).toEqual(message)
    expect(ImportModuleSchema.shape.detail.parse(message.detail)).toBe(message.detail)
  })

  test('accepts cache-busting query and hash suffixes', () => {
    expect(ImportModuleSchema.shape.detail.parse('/modules/widget.js?v=123')).toBe('/modules/widget.js?v=123')
    expect(ImportModuleSchema.shape.detail.parse('/modules/widget.js#v123')).toBe('/modules/widget.js#v123')
    expect(ImportModuleSchema.shape.detail.parse('/modules/widget.js?v=123#entry')).toBe(
      '/modules/widget.js?v=123#entry',
    )
  })

  test('rejects non-root and non-JavaScript import paths', () => {
    expect(() => ImportModuleSchema.shape.detail.parse('modules/widget.js')).toThrow()
    expect(() => ImportModuleSchema.shape.detail.parse('//example.com/widget.js')).toThrow()
    expect(() => ImportModuleSchema.shape.detail.parse('https://example.com/widget.js')).toThrow()
    expect(() => ImportModuleSchema.shape.detail.parse('/modules/widget.ts')).toThrow()
    expect(() => ImportModuleSchema.shape.detail.parse('/modules/widget.js.map')).toThrow()
    expect(() => ImportModuleSchema.shape.detail.parse('/modules/widget.js extra')).toThrow()
    expect(() => ImportModuleSchema.shape.detail.parse('/modules\\widget.js')).toThrow()
    expect(() =>
      ImportModuleSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.import,
        detail: 'file:///tmp/local-module.js',
      }),
    ).toThrow()
  })
})

describe('ControllerModuleDefaultSchema', () => {
  test('accepts imported module default functions', () => {
    const setup = () => {}
    expect(ControllerModuleDefaultSchema.parse(setup)).toBe(setup)
  })

  test('accepts async imported module default functions', () => {
    const setup = async () => {}
    expect(ControllerModuleDefaultSchema.parse(setup)).toBe(setup)
  })

  test('rejects imported modules without default functions', () => {
    expect(() => ControllerModuleDefaultSchema.parse(undefined)).toThrow()
    expect(() => ControllerModuleDefaultSchema.parse({})).toThrow()
  })
})

describe('ClientMessageSchema', () => {
  test('accepts UI BP event messages sent from browser controller', () => {
    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'test_click',
        detail: {
          [Symbol.toStringTag]: 'not serialized',
        },
      },
    }
    expect(UiEventMessageSchema.parse(message)).toEqual(message)
    expect(ClientMessageSchema.parse(message)).toEqual(message)
  })

  test('accepts import_invoked as a BP event inside ui_event', () => {
    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: CONTROLLER_TO_AGENT_EVENTS.import_invoked,
        detail: '/dist/modules/controller-module.js',
      },
    }
    expect(UiEventMessageSchema.parse(message)).toEqual(message)
    expect(ClientMessageSchema.parse(message)).toEqual(message)
  })

  test('accepts controller error messages sent from browser controller', () => {
    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: 'failed to import module',
    }
    expect(ControllerErrorMessageSchema.parse(message)).toEqual(message)
    expect(ClientMessageSchema.parse(message)).toEqual(message)
  })

  test('rejects invalid client message envelopes', () => {
    expect(() =>
      ClientMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        detail: {},
      }),
    ).toThrow()
    expect(() =>
      ClientMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.error,
        detail: { message: 'not a string' },
      }),
    ).toThrow()
    expect(() =>
      ClientMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.import_invoked,
        detail: '/dist/modules/controller-module.js',
      }),
    ).toThrow()
  })
})
