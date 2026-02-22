import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { Disconnect } from '../../behavioral.ts'
import { behavioral } from '../../behavioral.ts'
import { CONTROLLER_EVENTS, SWAP_MODES } from '../controller.constants.ts'
import { controller } from '../controller.ts'
import { P_TARGET, P_TRIGGER } from '../create-template.constants.ts'

// ─── WebSocket Mock ───────────────────────────────────────────────────────────
// Cannot extend native EventTarget because happy-dom replaces it and rejects
// events from the native Event class. Use a simple listener registry instead.

type EventHandler = EventListenerOrEventListenerObject

class MockWebSocket {
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
  sent: string[] = []
  #listeners = new Map<string, Set<EventHandler>>()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
    // Auto-fire open event on next microtask (unless disabled for retry testing)
    if (MockWebSocket.autoOpen) {
      queueMicrotask(() => {
        if (this.readyState === MockWebSocket.CONNECTING) {
          this.readyState = MockWebSocket.OPEN
          this.#dispatch('open', { type: 'open', target: this } as unknown as Event)
        }
      })
    }
  }

  addEventListener(type: string, handler: EventHandler) {
    if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
    this.#listeners.get(type)!.add(handler)
  }

  removeEventListener(type: string, handler: EventHandler) {
    this.#listeners.get(type)?.delete(handler)
  }

  #dispatch(type: string, event: Event | Record<string, unknown>) {
    const handlers = this.#listeners.get(type)
    if (!handlers) return
    for (const handler of handlers) {
      if (typeof handler === 'function') handler(event as Event)
      else handler.handleEvent(event as Event)
    }
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
  }

  /** Simulate a server message. Uses happy-dom's MessageEvent for instanceof checks. */
  simulateMessage(data: unknown) {
    const event = new MessageEvent('message', { data: JSON.stringify(data) })
    this.#dispatch('message', event)
  }

  /** Simulate a close with code. Uses happy-dom's CloseEvent for instanceof checks. */
  simulateClose(code: number) {
    this.readyState = MockWebSocket.CLOSED
    const event = new CloseEvent('close', { code })
    this.#dispatch('close', event)
  }

  static instances: MockWebSocket[] = []
  static autoOpen = true
  static reset() {
    MockWebSocket.instances = []
    MockWebSocket.autoOpen = true
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let originalWebSocket: typeof globalThis.WebSocket
let originalLocation: typeof globalThis.location

beforeAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.register()

  // Polyfill setHTMLUnsafe (happy-dom lacks it)
  if (!HTMLTemplateElement.prototype.setHTMLUnsafe) {
    HTMLTemplateElement.prototype.setHTMLUnsafe = function (html: string) {
      this.innerHTML = html
    }
  }

  // Store originals and install mocks
  originalWebSocket = globalThis.WebSocket
  originalLocation = globalThis.location

  // @ts-expect-error - mock WebSocket
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket
})

afterAll(async () => {
  globalThis.WebSocket = originalWebSocket
  // @ts-expect-error - restore location
  globalThis.location = originalLocation
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.unregister()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createTestRoot = () => {
  const root = document.createElement('div')
  root.innerHTML = `<div ${P_TARGET}="main"><p>initial</p></div>`
  document.body.appendChild(root)
  return root
}

const setupController = (root: Element) => {
  const { trigger, useFeedback, bThreads, useRestrictedTrigger, useSnapshot } = behavioral()
  const disconnectSet = new Set<Disconnect>()
  const restrictedTrigger = useRestrictedTrigger(
    ...[
      CONTROLLER_EVENTS.behavioral_updated,
      CONTROLLER_EVENTS.root_connected,
      CONTROLLER_EVENTS.user_action,
      CONTROLLER_EVENTS.snapshot,
      CONTROLLER_EVENTS.connect,
      CONTROLLER_EVENTS.retry,
      CONTROLLER_EVENTS.on_ws_error,
      CONTROLLER_EVENTS.on_ws_message,
      CONTROLLER_EVENTS.on_ws_open,
    ],
  )
  controller({
    trigger,
    root,
    bThreads,
    useFeedback,
    disconnectSet,
    restrictedTrigger,
    useSnapshot,
  })
  return { trigger, useFeedback, bThreads, disconnectSet, restrictedTrigger }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('controller: WebSocket lifecycle', () => {
  beforeEach(() => {
    MockWebSocket.reset()
    document.body.innerHTML = ''
    // Set location for WS URL construction
    Object.defineProperty(self, 'location', {
      value: { origin: 'http://localhost:3457' },
      writable: true,
      configurable: true,
    })
  })

  test('connect creates a WebSocket on initialization', async () => {
    const root = createTestRoot()
    setupController(root)

    // controller() calls trigger({ type: 'connect' }) which creates a WebSocket
    await new Promise((r) => setTimeout(r, 50))
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(1)
    expect(MockWebSocket.instances[0]!.url).toBe('ws://localhost:3457')
  })

  test('sends root_connected on WebSocket open', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!
    const sent = ws.sent.map((s) => JSON.parse(s))
    const rootConnected = sent.find((m: { type: string }) => m.type === CONTROLLER_EVENTS.root_connected)
    expect(rootConnected).toBeDefined()
    expect(rootConnected!.detail).toBe('div')
  })

  test('retries on close code 1006', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!
    ws.simulateClose(1006)

    // Wait for retry timeout (random up to 1000ms for first retry)
    await new Promise((r) => setTimeout(r, 1100))
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2)
  })

  test('retries on close code 1012', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!
    ws.simulateClose(1012)

    await new Promise((r) => setTimeout(r, 1100))
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2)
  })

  test('retries on close code 1013', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!
    ws.simulateClose(1013)

    await new Promise((r) => setTimeout(r, 1100))
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2)
  })

  test('does not retry on normal close code 1000', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const initialCount = MockWebSocket.instances.length
    const ws = MockWebSocket.instances[0]!
    ws.simulateClose(1000)

    await new Promise((r) => setTimeout(r, 1100))
    // No new WebSocket instances should be created
    expect(MockWebSocket.instances.length).toBe(initialCount)
  })

  test('stops retrying after MAX_RETRIES (3)', async () => {
    const root = createTestRoot()
    setupController(root)

    // Let initial socket open normally
    await new Promise((r) => setTimeout(r, 50))
    expect(MockWebSocket.instances.length).toBe(1)

    // Disable auto-open so retried sockets never fire on_ws_open,
    // which would reset retryCount to 0 and defeat the accumulation test.
    MockWebSocket.autoOpen = false

    // Simulate 3 consecutive failures — retryCount accumulates 0→1→2→3
    for (let i = 0; i < 3; i++) {
      const ws = MockWebSocket.instances.at(-1)!
      ws.simulateClose(1006)
      // Wait for exponential backoff delay + new socket creation
      await new Promise((r) => setTimeout(r, Math.min(9999, 1000 * 2 ** i) + 200))
      // Verify a new socket was created by the retry
      expect(MockWebSocket.instances.length).toBe(2 + i)
    }

    // retryCount is now 3 (=== MAX_RETRIES). One more close should NOT retry.
    const countAfterRetries = MockWebSocket.instances.length
    const ws = MockWebSocket.instances.at(-1)!
    ws.simulateClose(1006)
    await new Promise((r) => setTimeout(r, 1200))

    expect(MockWebSocket.instances.length).toBe(countAfterRetries)
  }, 30000)

  test('disconnect handler closes WebSocket', async () => {
    const root = createTestRoot()
    const { trigger } = setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!
    expect(ws.readyState).toBe(MockWebSocket.OPEN)

    trigger({ type: CONTROLLER_EVENTS.disconnect })
    await new Promise((r) => setTimeout(r, 50))
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  test('snapshots are sent over WebSocket when socket is open', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    // Trigger an event to generate a snapshot (any BP event produces one)
    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<span>snap</span>' },
    })
    await new Promise((r) => setTimeout(r, 50))

    const sent = ws.sent.map((s) => JSON.parse(s))
    const snapshots = sent.filter((m: { type: string }) => m.type === CONTROLLER_EVENTS.snapshot)
    expect(snapshots.length).toBeGreaterThan(0)
  })

  test('no recursion when useSnapshot fires before socket exists', () => {
    // This test verifies the fix for the snapshot → send → connect recursion.
    // Before the fix, calling controller() would throw RangeError (stack overflow)
    // because useSnapshot fired during the first super-step before the connect
    // handler created the socket, and send() would re-trigger connect.
    const root = createTestRoot()
    expect(() => setupController(root)).not.toThrow()
  })
})

describe('controller: render handler', () => {
  beforeEach(() => {
    MockWebSocket.reset()
    document.body.innerHTML = ''
    Object.defineProperty(self, 'location', {
      value: { origin: 'http://localhost:3457' },
      writable: true,
      configurable: true,
    })
  })

  test('innerHTML swap replaces element content', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    // Server sends render message
    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<span>replaced</span>', swap: SWAP_MODES.innerHTML },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target).toBeDefined()
    expect(target!.innerHTML).toContain('replaced')
  })

  test('outerHTML swap replaces the element itself', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: `<section ${P_TARGET}="main">outer-replaced</section>`,
        swap: SWAP_MODES.outerHTML,
      },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target).toBeDefined()
    expect(target!.tagName.toLowerCase()).toBe('section')
    expect(target!.textContent).toContain('outer-replaced')
  })

  test('afterbegin swap prepends content', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<em>prepended</em>', swap: SWAP_MODES.afterbegin },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target!.firstElementChild!.tagName.toLowerCase()).toBe('em')
    expect(target!.firstElementChild!.textContent).toBe('prepended')
  })

  test('beforeend swap appends content', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<em>appended</em>', swap: SWAP_MODES.beforeend },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target!.lastElementChild!.tagName.toLowerCase()).toBe('em')
    expect(target!.lastElementChild!.textContent).toBe('appended')
  })

  test('afterend swap inserts after target', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<aside>after</aside>', swap: SWAP_MODES.afterend },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target!.nextElementSibling!.tagName.toLowerCase()).toBe('aside')
  })

  test('beforebegin swap inserts before target', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<header>before</header>', swap: SWAP_MODES.beforebegin },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target!.previousElementSibling!.tagName.toLowerCase()).toBe('header')
  })

  test('defaults to innerHTML when swap is omitted', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: { target: 'main', html: '<b>default-swap</b>' },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target!.innerHTML).toContain('default-swap')
  })

  test('missing target silently returns (no error)', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    // Should not throw — target "nonexistent" doesn't exist
    expect(() => {
      ws.simulateMessage({
        type: CONTROLLER_EVENTS.render,
        detail: { target: 'nonexistent', html: '<div>x</div>' },
      })
    }).not.toThrow()
  })
})

describe('controller: attrs handler', () => {
  beforeEach(() => {
    MockWebSocket.reset()
    document.body.innerHTML = ''
    Object.defineProperty(self, 'location', {
      value: { origin: 'http://localhost:3457' },
      writable: true,
      configurable: true,
    })
  })

  test('sets string attribute', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { class: 'active' } },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target!.getAttribute('class')).toBe('active')
  })

  test('removes attribute when value is null', async () => {
    const root = createTestRoot()
    const target = root.querySelector(`[${P_TARGET}="main"]`)!
    target.setAttribute('data-old', 'value')
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { 'data-old': null } },
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(target.hasAttribute('data-old')).toBe(false)
  })

  test('sets boolean attribute (toggle)', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    ws.simulateMessage({
      type: CONTROLLER_EVENTS.attrs,
      detail: { target: 'main', attr: { disabled: true } },
    })

    await new Promise((r) => setTimeout(r, 50))
    const target = root.querySelector(`[${P_TARGET}="main"]`)
    expect(target!.hasAttribute('disabled')).toBe(true)
  })

  test('missing target logs error (does not throw)', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    // Should not throw
    expect(() => {
      ws.simulateMessage({
        type: CONTROLLER_EVENTS.attrs,
        detail: { target: 'nonexistent', attr: { class: 'x' } },
      })
    }).not.toThrow()
  })
})

describe('controller: user_action handler', () => {
  beforeEach(() => {
    MockWebSocket.reset()
    document.body.innerHTML = ''
    Object.defineProperty(self, 'location', {
      value: { origin: 'http://localhost:3457' },
      writable: true,
      configurable: true,
    })
  })

  test('p-trigger element click is forwarded to WebSocket', async () => {
    const root = createTestRoot()
    setupController(root)

    await new Promise((r) => setTimeout(r, 50))
    const ws = MockWebSocket.instances[0]!

    // Render content with a p-trigger element
    ws.simulateMessage({
      type: CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: `<button ${P_TRIGGER}="click:submit_form">Submit</button>`,
        swap: SWAP_MODES.innerHTML,
      },
    })

    await new Promise((r) => setTimeout(r, 50))

    // Click the trigger element
    const button = root.querySelector('button')!
    button.click()

    await new Promise((r) => setTimeout(r, 50))

    // Check that user_action was sent over WebSocket
    const sent = ws.sent.map((s) => JSON.parse(s))
    const userAction = sent.find((m: { type: string }) => m.type === CONTROLLER_EVENTS.user_action)
    expect(userAction).toBeDefined()
    expect(userAction!.detail).toBe('submit_form')
  })
})
