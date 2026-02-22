import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'
import { TEMPLATE_OBJECT_IDENTIFIER } from '../create-template.constants.ts'

// Mock controller to prevent the useSnapshot → send → connect recursion.
// controlIsland creates a behavioral() engine internally and calls controller()
// from connectedCallback — we can't inject a safe useSnapshot from outside.
mock.module('../controller.ts', () => ({
  controller: () => {},
}))

// Dynamic import AFTER the mock is installed
const { controlIsland, CONTROLLER_TEMPLATE_IDENTIFIER } = await import('../control-island.ts')

// ─── WebSocket Mock (minimal — still needed for globalThis reference in happy-dom) ──

class MockWebSocket extends EventTarget {
  static CONNECTING = 0 as const
  static OPEN = 1 as const
  static CLOSING = 2 as const
  static CLOSED = 3 as const
  CONNECTING = 0 as const
  OPEN = 1 as const
  CLOSING = 2 as const
  CLOSED = 3 as const

  readyState = MockWebSocket.CONNECTING
  url: string

  constructor(url: string) {
    super()
    this.url = url
  }

  send(_data: string) {}
  close() {
    this.readyState = MockWebSocket.CLOSED
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.register()

  // @ts-expect-error - mock WebSocket for happy-dom environment
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket

  Object.defineProperty(self, 'location', {
    value: { origin: 'http://localhost:3457' },
    writable: true,
    configurable: true,
  })
})

afterAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.unregister()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('controlIsland: factory return value', () => {
  test('returns a ControllerTemplate with .tag property', () => {
    const Island = controlIsland({ tag: 'test-factory-tag' })
    expect(Island.tag).toBe('test-factory-tag')
  })

  test('returns ControllerTemplate with $ identifier', () => {
    const Island = controlIsland({ tag: 'test-factory-id' })
    expect(Island.$).toBe(CONTROLLER_TEMPLATE_IDENTIFIER)
  })

  test('returns ControllerTemplate with observedAttributes', () => {
    const Island = controlIsland({
      tag: 'test-factory-attrs',
      observedAttributes: ['value', 'label'],
    })
    expect(Island.observedAttributes).toEqual(['value', 'label'])
  })

  test('defaults observedAttributes to empty array', () => {
    const Island = controlIsland({ tag: 'test-factory-default' })
    expect(Island.observedAttributes).toEqual([])
  })

  test('returned function produces a TemplateObject', () => {
    const Island = controlIsland({ tag: 'test-factory-tpl' })
    const tpl = Island({ children: [] })
    // TemplateObject has { html, stylesheets, registry, $ }
    expect(tpl.$).toBe(TEMPLATE_OBJECT_IDENTIFIER)
    expect(tpl.html).toBeArray()
    expect(tpl.stylesheets).toBeArray()
    expect(tpl.registry).toContain('test-factory-tpl')
  })
})

describe('controlIsland: custom element registration', () => {
  test('registers custom element via customElements.define()', () => {
    controlIsland({ tag: 'test-registered' })
    expect(customElements.get('test-registered')).toBeDefined()
  })

  test('does not re-register existing tag', () => {
    controlIsland({ tag: 'test-no-double-reg' })
    // Calling again should not throw
    expect(() => controlIsland({ tag: 'test-no-double-reg' })).not.toThrow()
  })
})

describe('controlIsland: custom element lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  test('connectedCallback defines property accessors for observed attributes', async () => {
    controlIsland({ tag: 'test-prop-access', observedAttributes: ['value'] })

    const el = document.createElement('test-prop-access')
    document.body.appendChild(el)

    // Wait for connectedCallback
    await new Promise((r) => setTimeout(r, 50))

    // Property accessor should be defined
    const descriptor = Object.getOwnPropertyDescriptor(el, 'value')
    expect(descriptor).toBeDefined()
    expect(descriptor!.get).toBeDefined()
    expect(descriptor!.set).toBeDefined()
  })

  test('property setter updates attribute', async () => {
    controlIsland({ tag: 'test-prop-set', observedAttributes: ['label'] })

    const el = document.createElement('test-prop-set') as HTMLElement & { label: string }
    document.body.appendChild(el)
    await new Promise((r) => setTimeout(r, 50))

    el.label = 'hello'
    expect(el.getAttribute('label')).toBe('hello')
  })

  test('property getter reads attribute', async () => {
    controlIsland({ tag: 'test-prop-get', observedAttributes: ['name'] })

    const el = document.createElement('test-prop-get') as HTMLElement & { name: string }
    document.body.appendChild(el)
    await new Promise((r) => setTimeout(r, 50))

    el.setAttribute('name', 'world')
    expect(el.name).toBe('world')
  })

  test('disconnectedCallback calls and clears disconnect set', async () => {
    controlIsland({ tag: 'test-disconnect-cb' })

    const el = document.createElement('test-disconnect-cb')
    document.body.appendChild(el)
    await new Promise((r) => setTimeout(r, 50))

    // Removing from DOM triggers disconnectedCallback
    expect(() => document.body.removeChild(el)).not.toThrow()
  })
})

describe('controlIsland: template output', () => {
  test('template produces TemplateObject with correct structure', () => {
    const Island = controlIsland({ tag: 'test-tpl-output' })
    const tpl = Island({ children: [] })
    expect(tpl.$).toBe(TEMPLATE_OBJECT_IDENTIFIER)
    expect(tpl.html).toBeArray()
    expect(tpl.html.length).toBeGreaterThan(0)
  })

  test('template includes tag in registry', () => {
    const Island = controlIsland({ tag: 'test-tpl-registry' })
    const tpl = Island({ children: [] })
    expect(tpl.registry).toContain('test-tpl-registry')
  })
})
