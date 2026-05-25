import { describe, expect, test } from 'bun:test'
import { SITE_ROOT_JAVASCRIPT_PATH_PATTERN } from '../../render/template.constants.ts'
import { AGENT_TO_CONTROLLER_EVENTS } from '../../shared/shared.constants.ts'
import { CONTROLLER_TO_AGENT_EVENTS, SWAP_MODES } from '../controller.constants.ts'
import {
  AttrsMessageSchema,
  ClientMessageSchema,
  ControllerErrorMessageSchema,
  CustomElementTagSchema,
  FormSubmitMessageSchema,
  ImportModuleSchema,
  RenderMessageSchema,
  ServerMessageSchema,
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

describe('CustomElementTagSchema', () => {
  test('accepts valid normalized custom element tags', () => {
    expect(CustomElementTagSchema.parse('sample-element')).toBe('sample-element')
    expect(CustomElementTagSchema.parse('sample.element-1')).toBe('sample.element-1')
  })

  test('rejects invalid custom element tags', () => {
    expect(() => CustomElementTagSchema.parse('sample')).toThrow()
    expect(() => CustomElementTagSchema.parse('Sample-element')).toThrow()
    expect(() => CustomElementTagSchema.parse('font-face')).toThrow()
  })
})

describe('RenderMessageSchema', () => {
  test('accepts valid render message with swap', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        version: '1',
        target: 'main',
        html: '<div>hello</div>',
        stylesheets: ['.sample{display:block;}'],
        swap: SWAP_MODES.innerHTML,
        registry: ['sample-element' as const],
      },
    }
    expect(RenderMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts render message without swap (optional)', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: { version: '1', target: 'main', html: '<p>content</p>', stylesheets: [], registry: [] },
    }
    expect(RenderMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects render message with wrong type', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: 'wrong',
        detail: { version: '1', target: 'main', html: '<div/>', stylesheets: [], registry: [] },
      }),
    ).toThrow()
  })

  test('rejects render message missing target', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { html: '<div/>', stylesheets: [], registry: [] },
      }),
    ).toThrow('target')
  })

  test('rejects render message missing html', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { target: 'main', stylesheets: [], registry: [] },
      }),
    ).toThrow('html')
  })

  test('rejects render message with invalid swap mode', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { version: '1', target: 'main', html: '<div/>', stylesheets: [], swap: 'replace', registry: [] },
      }),
    ).toThrow()
  })

  test('rejects render messages missing stylesheets', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { version: '1', target: 'main', html: '<div/>', registry: [] },
      }),
    ).toThrow()
  })

  test('rejects render messages with invalid stylesheets', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { version: '1', target: 'main', html: '<div/>', stylesheets: [42], registry: [] },
      }),
    ).toThrow()
  })

  test('rejects render messages missing registry', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { version: '1', target: 'main', html: '<div/>', stylesheets: [] },
      }),
    ).toThrow()
  })

  test('rejects render messages with invalid registry tags', () => {
    expect(() =>
      RenderMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { version: '1', target: 'main', html: '<div/>', stylesheets: [], registry: ['font-face'] },
      }),
    ).toThrow()
  })
})

describe('AttrsMessageSchema', () => {
  test('accepts valid attrs message with string value', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: { version: '1', target: 'main', attr: { class: 'active' } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with null value (remove)', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: { version: '1', target: 'main', attr: { class: null } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with number value', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: { version: '1', target: 'main', attr: { tabindex: 0 } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('accepts attrs with boolean value', () => {
    const msg = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: { version: '1', target: 'main', attr: { disabled: true } },
    }
    expect(AttrsMessageSchema.parse(msg)).toEqual(msg)
  })

  test('rejects attrs with wrong type', () => {
    expect(() =>
      AttrsMessageSchema.parse({
        type: 'wrong',
        detail: { version: '1', target: 'main', attr: {} },
      }),
    ).toThrow()
  })

  test('rejects attrs with non-primitive values', () => {
    expect(() =>
      AttrsMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.attrs,
        detail: { version: '1', target: 'main', attr: { dataset: { nested: true } } },
      }),
    ).toThrow()
  })
})

describe('ImportModuleSchema', () => {
  test('exports the shared site-root JavaScript path pattern', () => {
    expect(SITE_ROOT_JAVASCRIPT_PATH_PATTERN.test('/modules/widget.js')).toBe(true)
    expect(SITE_ROOT_JAVASCRIPT_PATH_PATTERN.test('/modules/widget.js?v=123#entry')).toBe(true)
    expect(SITE_ROOT_JAVASCRIPT_PATH_PATTERN.test('/modules/widget?file=.js')).toBe(false)
    expect(SITE_ROOT_JAVASCRIPT_PATH_PATTERN.test('/modules/widget#file=.js')).toBe(false)
  })

  test('accepts import messages with site-root JavaScript path detail', () => {
    const message = {
      type: AGENT_TO_CONTROLLER_EVENTS.import,
      detail: { version: '1', path: '/dist/modules/controller-module.js' },
    }
    expect(ImportModuleSchema.parse(message)).toEqual(message)
    expect(ImportModuleSchema.shape.detail.parse(message.detail)).toEqual(message.detail)
  })

  test('accepts cache-busting query and hash suffixes', () => {
    const parsePath = (path: string) => ImportModuleSchema.shape.detail.parse({ version: '1', path })
    expect(parsePath('/modules/widget.js?v=123')).toEqual({ version: '1', path: '/modules/widget.js?v=123' })
    expect(parsePath('/modules/widget.js#v123')).toEqual({ version: '1', path: '/modules/widget.js#v123' })
    expect(parsePath('/modules/widget.js?v=123#entry')).toEqual({
      version: '1',
      path: '/modules/widget.js?v=123#entry',
    })
  })

  test('rejects non-root and non-JavaScript import paths', () => {
    const rejectPath = (path: string) => () => ImportModuleSchema.shape.detail.parse({ version: '1', path })
    expect(rejectPath('modules/widget.js')).toThrow()
    expect(rejectPath('//example.com/widget.js')).toThrow()
    expect(rejectPath('https://example.com/widget.js')).toThrow()
    expect(rejectPath('/modules/widget.ts')).toThrow()
    expect(rejectPath('/modules/widget.js.map')).toThrow()
    expect(rejectPath('/modules/widget?file=.js')).toThrow()
    expect(rejectPath('/modules/widget#file=.js')).toThrow()
    expect(rejectPath('/modules/widget.js extra')).toThrow()
    expect(rejectPath('/modules\\widget.js')).toThrow()
    expect(() =>
      ImportModuleSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.import,
        detail: { version: '1', path: 'file:///tmp/local-module.js' },
      }),
    ).toThrow()
  })
})

describe('ServerMessageSchema', () => {
  test('accepts valid import messages', () => {
    const message = {
      type: AGENT_TO_CONTROLLER_EVENTS.import,
      detail: { version: '1', path: '/dist/modules/controller-module.js' },
    }
    expect(ServerMessageSchema.parse(message)).toEqual(message)
  })

  test('accepts valid render messages', () => {
    const message = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        version: '1',
        target: 'main',
        html: '<div/>',
        stylesheets: [],
        registry: [],
      },
    }
    expect(ServerMessageSchema.parse(message)).toEqual(message)
  })

  test('accepts valid disconnect messages', () => {
    const message = {
      type: AGENT_TO_CONTROLLER_EVENTS.disconnect,
      detail: { version: '1' },
    }
    expect(ServerMessageSchema.parse(message)).toEqual(message)
  })

  test('rejects messages with unknown type', () => {
    expect(() =>
      ServerMessageSchema.parse({
        type: 'unknown_type',
        detail: { version: '1' },
      }),
    ).toThrow()
  })

  test('rejects messages missing version', () => {
    expect(() =>
      ServerMessageSchema.parse({
        type: AGENT_TO_CONTROLLER_EVENTS.render,
        detail: { target: 'main', html: '<div/>', stylesheets: [], registry: [] },
      }),
    ).toThrow()
  })
})

describe('ClientMessageSchema', () => {
  test('accepts UI BP event messages sent from browser controller', () => {
    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        topic: 'test-topic',
        version: '1',
        event: {
          type: 'test_click',
          detail: {
            source: 'button',
          },
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
        topic: 'test-topic',
        version: '1',
        event: {
          type: CONTROLLER_TO_AGENT_EVENTS.import_invoked,
          detail: { path: '/dist/modules/controller-module.js' },
        },
      },
    }
    expect(UiEventMessageSchema.parse(message)).toEqual(message)
    expect(ClientMessageSchema.parse(message)).toEqual(message)
  })

  test('accepts controller form submit messages', () => {
    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
      detail: {
        topic: 'sample-topic',
        version: '1',
        id: 'sample-form',
        action: '/submit',
        method: 'post',
        data: {
          name: 'Ada',
          tags: ['ui', 'controller'],
        },
      },
    }
    expect(FormSubmitMessageSchema.parse(message)).toEqual(message)
    expect(ClientMessageSchema.parse(message)).toEqual(message)
  })

  test('accepts controller error messages sent from browser controller', () => {
    const message = {
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: {
        topic: 'sample-topic',
        version: '1',
        message: 'failed to import module',
      },
    }
    expect(ControllerErrorMessageSchema.parse(message)).toEqual(message)
    expect(ClientMessageSchema.parse(message)).toEqual(message)
  })

  test('accepts structured controller error details with description and context', () => {
    expect(
      ControllerErrorMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.error,
        detail: {
          topic: null,
          version: null,
          message: 'invalid stylesheet',
          description: 'CSSStyleSheet replacement or adoption failed',
          context: {
            stylesheetLength: 44,
            stylesheetPreview: '.test { color: red; }',
          },
        },
      }),
    ).toEqual({
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: {
        topic: null,
        version: null,
        message: 'invalid stylesheet',
        description: 'CSSStyleSheet replacement or adoption failed',
        context: {
          stylesheetLength: 44,
          stylesheetPreview: '.test { color: red; }',
        },
      },
    })
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
        detail: { topic: null, version: null, message: 42 },
      }),
    ).toThrow()
    expect(() =>
      ClientMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.error,
        detail: { topic: null, version: null, message: 'x', context: ['not', 'an', 'object'] },
      }),
    ).toThrow()
    expect(() =>
      ClientMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
        detail: {
          topic: null,
          version: null,
          id: 'sample-form',
          action: '/submit',
          method: 'post',
          data: {
            file: { name: 'avatar.png' },
          },
        },
      }),
    ).toThrow()
    expect(() =>
      ClientMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.import_invoked,
        detail: '/dist/modules/controller-module.js',
      }),
    ).toThrow()
    expect(() =>
      ClientMessageSchema.parse({
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        detail: {
          topic: null,
          version: null,
          event: {
            type: CONTROLLER_TO_AGENT_EVENTS.import_invoked,
            detail: '/dist/modules/controller-module.js',
          },
        },
      }),
    ).toThrow()
  })
})
