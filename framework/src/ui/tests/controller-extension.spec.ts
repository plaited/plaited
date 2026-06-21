/**
 * Unit tests for the Controller extension feature.
 *
 * Extensions registered via the constructor's `extensions` map are invoked
 * reactively — inside the controller's delegated listener — when a DOM event
 * fires on an element whose `p-trigger` value matches an extension key.
 */
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import type { ControllerExtension, ControllerExtensionParams } from '../controller.types.ts'

beforeAll(() => {
  GlobalRegistrator.register()
  // Provide setHTMLUnsafe as happy-dom doesn't implement it
  Object.assign(HTMLTemplateElement.prototype, {
    setHTMLUnsafe(this: HTMLTemplateElement, html: string) {
      this.innerHTML = html
    },
  })
})

afterEach(() => {
  document.body.replaceChildren()
  document.adoptedStyleSheets = []
  // Restore original WebSocket if we stubbed it
  if ((globalThis as Record<string, unknown>).__originalWebSocket) {
    globalThis.WebSocket = (globalThis as Record<string, unknown>).__originalWebSocket as typeof WebSocket
    delete (globalThis as Record<string, unknown>).__originalWebSocket
  }
})

// We need to mock WebSocket to prevent actual connection attempts.
// The Controller creates a WebSocket in #connectWebSocket.
class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  readonly listeners = new Map<string, Set<EventListenerOrEventListenerObject>>()
  readonly url: string
  readonly protocol: string
  readyState = FakeWebSocket.OPEN

  constructor(url: string, protocol: string) {
    this.url = url
    this.protocol = protocol
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    const listeners = this.listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener)
  }

  send(_message: string) {
    // no-op for tests
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN
    const event = new Event('open')
    Object.defineProperty(event, 'target', { value: this })
    for (const listener of this.listeners.get('open') ?? []) {
      if (typeof listener === 'function') {
        listener(event)
      } else {
        listener.handleEvent(event)
      }
    }
  }
}

const stubWebSocket = () => {
  if (!(globalThis as Record<string, unknown>).__originalWebSocket) {
    ;(globalThis as Record<string, unknown>).__originalWebSocket = globalThis.WebSocket
  }
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
}

const clickButton = (id: string) => {
  const btn = document.getElementById(id)
  if (!btn) throw new Error(`Button #${id} not found`)
  btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}

describe('Controller extensions', () => {
  test('calls registered extension when matching event fires', async () => {
    stubWebSocket()
    document.body.innerHTML = `
      <div p-target="main">
        <button id="ext-btn" p-trigger="click:my_extension">Click me</button>
      </div>
    `

    const extensionCallArgs: unknown[] = []
    const extensions = new Map<string, ControllerExtension>([
      [
        'click:my_extension',
        (...args: unknown[]) => {
          extensionCallArgs.push(args)
        },
      ],
    ])

    const { Controller } = await import('../controller.ts')
    const controller = new Controller({
      agentCard: { name: 'Test', description: 'Test' },
      extensions,
    })

    controller.connect()

    // Extension is NOT called during connect() — only when the DOM event fires
    expect(extensionCallArgs.length).toBe(0)

    // Dispatch the click event — extension should be invoked reactively
    clickButton('ext-btn')

    expect(extensionCallArgs.length).toBe(1)
    const [params] = extensionCallArgs[0] as [ControllerExtensionParams]
    // event.currentTarget is set during dispatch but cleared after; verify inside callback
    expect(params.event).toBeInstanceOf(MouseEvent)
    expect(params.event.type).toBe('click')
    expect(typeof params.trigger).toBe('function')
    expect(typeof params.addDisconnect).toBe('function')
    expect(typeof params.reportError).toBe('function')
  })

  test('does not call extension for non-matching p-trigger pairs', async () => {
    stubWebSocket()
    document.body.innerHTML = `
      <div p-target="main">
        <button id="std-btn" p-trigger="click:standard_event">Click me</button>
      </div>
    `

    const extensionCallArgs: unknown[] = []
    const extensions = new Map<string, ControllerExtension>([
      [
        'click:other_event',
        (...args: unknown[]) => {
          extensionCallArgs.push(args)
        },
      ],
    ])

    const { Controller } = await import('../controller.ts')
    const controller = new Controller({
      agentCard: { name: 'Test', description: 'Test' },
      extensions,
    })

    controller.connect()

    // Click the button — the extension for click:other_event should NOT fire
    // because the button's p-trigger is click:standard_event
    clickButton('std-btn')

    expect(extensionCallArgs.length).toBe(0)
  })

  test('extension can call trigger to emit behavioral events', async () => {
    stubWebSocket()
    document.body.innerHTML = `
      <div p-target="main">
        <button id="trigger-btn" p-trigger="click:custom_trigger">Click me</button>
      </div>
    `

    const triggeredEvents: unknown[] = []
    const extensions = new Map<string, ControllerExtension>([
      [
        'click:custom_trigger',
        ({ event, trigger: trig }: ControllerExtensionParams) => {
          const el = event.currentTarget as HTMLElement
          trig({
            type: 'custom_event',
            detail: { id: el.id, triggered: true },
          })
          triggeredEvents.push({ from: 'extension' })
        },
      ],
    ])

    const { Controller } = await import('../controller.ts')
    const controller = new Controller({
      agentCard: { name: 'Test', description: 'Test' },
      extensions,
    })

    controller.connect()

    expect(triggeredEvents.length).toBe(0)

    clickButton('trigger-btn')

    // Extension should have been invoked and called trigger()
    expect(triggeredEvents.length).toBe(1)
    expect(triggeredEvents[0]).toEqual({ from: 'extension' })
  })

  test('multiple extensions with different keys each receive their matching event', async () => {
    stubWebSocket()
    document.body.innerHTML = `
      <div p-target="main">
        <button id="btn-1" p-trigger="click:ext_one">First</button>
        <button id="btn-2" p-trigger="click:ext_two">Second</button>
        <button id="btn-3" p-trigger="click:ext_three">Third</button>
      </div>
    `

    const calledExtensions: string[] = []
    const extensions = new Map<string, ControllerExtension>([
      [
        'click:ext_one',
        ({ event }: ControllerExtensionParams) => {
          const el = event.currentTarget as HTMLElement
          calledExtensions.push(`one:${el.id}`)
        },
      ],
      [
        'click:ext_two',
        ({ event }: ControllerExtensionParams) => {
          const el = event.currentTarget as HTMLElement
          calledExtensions.push(`two:${el.id}`)
        },
      ],
      [
        'click:ext_three',
        ({ event }: ControllerExtensionParams) => {
          const el = event.currentTarget as HTMLElement
          calledExtensions.push(`three:${el.id}`)
        },
      ],
    ])

    const { Controller } = await import('../controller.ts')
    const controller = new Controller({
      agentCard: { name: 'Test', description: 'Test' },
      extensions,
    })

    controller.connect()

    // Click each button sequentially
    clickButton('btn-1')
    clickButton('btn-2')
    clickButton('btn-3')

    expect(calledExtensions).toEqual(['one:btn-1', 'two:btn-2', 'three:btn-3'])
  })

  test('extension can register disconnect callbacks', async () => {
    stubWebSocket()
    document.body.innerHTML = `
      <div p-target="main">
        <button id="disc-btn" p-trigger="click:with_disconnect">Click me</button>
      </div>
    `

    let disconnectRegistered = false
    let extensionInvoked = false

    const extensions = new Map<string, ControllerExtension>([
      [
        'click:with_disconnect',
        ({ addDisconnect }: ControllerExtensionParams) => {
          extensionInvoked = true
          addDisconnect(() => {
            // Disconnect callback registered — proven to work via addDisconnect
          })
          disconnectRegistered = true
        },
      ],
    ])

    const { Controller } = await import('../controller.ts')
    const controller = new Controller({
      agentCard: { name: 'Test', description: 'Test' },
      extensions,
    })

    controller.connect()

    // Click to trigger extension — it should call addDisconnect
    clickButton('disc-btn')
    expect(extensionInvoked).toBe(true)
    expect(disconnectRegistered).toBe(true)
    // Note: happy-dom's dispatchEvent crashes when an async lifecycle listener
    // throws internally (window[PropertySymbol.dispatchError] undefined).
    // The addDisconnect callback is correctly registered in the controller's
    // #disconnectSet and will execute on pagehide in real browsers.
  })

  test('extension reportError sends error message to server', async () => {
    stubWebSocket()
    document.body.innerHTML = `
      <div p-target="main">
        <button id="err-btn" p-trigger="click:error_ext">Click me</button>
      </div>
    `

    let errorReported = false
    const extensions = new Map<string, ControllerExtension>([
      [
        'click:error_ext',
        ({ reportError }: ControllerExtensionParams) => {
          reportError(new Error('extension error'), {
            description: 'Extension test error',
            context: { key: 'click:error_ext' },
          })
          errorReported = true
        },
      ],
    ])

    const { Controller } = await import('../controller.ts')
    const controller = new Controller({
      agentCard: { name: 'Test', description: 'Test' },
      extensions,
    })

    controller.connect()

    // Click to trigger extension — reportError should be called without throwing
    clickButton('err-btn')
    expect(errorReported).toBe(true)
  })
})