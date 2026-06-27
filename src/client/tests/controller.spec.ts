/**
 * Unit tests for the UI Controller.
 *
 * Drives the controller directly through a {@link FakeWebSocket} in happy-dom,
 * exercising every server-message handler, the outbound send/queue path, retry,
 * trigger routing, extensions, form POST, and error reporting — without a real
 * browser. Page-lifecycle event routing (pageshow/pagehide/bfcache) is covered
 * by the real-browser suite, where each navigation yields a fresh `window`.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { P_FORM_TRIGGER, SERVER_TO_CONTROLLER_EVENTS } from '../../shared/shared.constants.ts'
import type { ClientMessage } from '../../shared/shared.schemas.ts'
import { UI_CORE_MAX_RETRIES } from '../controller.constants.ts'
import { Controller } from '../controller.ts'
import { FakeWebSocket } from './helpers/fake-websocket.ts'

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const stubPage = (html: string) => {
  document.body.innerHTML = html
}

const renderMessage = (overrides: Record<string, unknown> = {}) => ({
  type: SERVER_TO_CONTROLLER_EVENTS.render,
  detail: {
    id: 'test-render',
    target: 'main',
    html: '<p>rendered</p>',
    stylesheets: [],
    swap: 'innerHTML',
    ...overrides,
  },
})

/** Messages the controller has sent, parsed back into ClientMessage objects. */
const sentMessages = (ws: FakeWebSocket): ClientMessage[] => ws.sent.map((raw) => JSON.parse(raw) as ClientMessage)

const findSent = (ws: FakeWebSocket, type: string): ClientMessage | undefined =>
  sentMessages(ws).find((m) => m.type === type)

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// ─── Test harness setup ──────────────────────────────────────────────────────

let originalWebSocket: typeof WebSocket
let originalFetch: typeof fetch
let originalRandom: typeof Math.random
let originalAssign: typeof window.location.assign
let originalReplace: typeof window.location.replace
const locationCalls: string[] = []

beforeAll(() => {
  GlobalRegistrator.register()
  // happy-dom lacks Element.prototype.setHTMLUnsafe; the controller uses it to
  // parse server-rendered HTML. innerHTML is a faithful stand-in for tests.
  Object.assign(HTMLTemplateElement.prototype, {
    setHTMLUnsafe(this: HTMLTemplateElement, html: string) {
      this.innerHTML = html
    },
  })
})

beforeEach(() => {
  originalWebSocket = globalThis.WebSocket
  originalFetch = globalThis.fetch
  originalRandom = Math.random
  originalWebSocket = globalThis.WebSocket
  originalFetch = globalThis.fetch
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket
  FakeWebSocket.reset()
  document.body.replaceChildren()
  document.adoptedStyleSheets = []
  locationCalls.length = 0
  originalAssign = window.location.assign.bind(window.location)
  originalReplace = window.location.replace.bind(window.location)
  window.location.assign = (url: string) => locationCalls.push(`assign:${url}`)
  window.location.replace = (url: string) => locationCalls.push(`replace:${url}`)
})

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
  globalThis.fetch = originalFetch
  Math.random = originalRandom
  window.location.assign = originalAssign
  window.location.replace = originalReplace
  document.body.replaceChildren()
  document.adoptedStyleSheets = []
})

const newController = (opts: ConstructorParameters<typeof Controller>[0] = {}) => {
  const controller = new Controller({ agentCardId: 'test', ...opts })
  return controller
}

// ─── Outbound send path & message queue ─────────────────────────────────────

describe('controller: send & message queue', () => {
  // Bind the body BEFORE connect(): #bind() reads document.body at call time,
  // and each connect() creates a fresh socket, so tests connect exactly once.
  const setupConnecting = (html: string) => {
    stubPage(html)
    const controller = newController()
    controller.connect()
    return { controller, ws: FakeWebSocket.last }
  }

  test('sends immediately when the socket is OPEN', () => {
    const { ws } = setupConnecting(`<button id="b" p-trigger="click:go">x</button>`)
    ws.serverOpen()
    ws.sent.length = 0

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(findSent(ws, 'ui_event')).toBeDefined()
  })

  test('queues messages while the socket is connecting and drains on open', () => {
    const { ws } = setupConnecting(`<button id="b" p-trigger="click:queued">x</button>`)
    expect(ws.readyState).toBe(FakeWebSocket.CONNECTING)

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    // Nothing sent yet — both queued
    expect(ws.sent.length).toBe(0)

    ws.serverOpen() // drains the queue

    const uiEvents = sentMessages(ws).filter((m) => m.type === 'ui_event')
    expect(uiEvents.length).toBe(2)
  })

  test('does not duplicate queued messages when multiple sends stack onOpen handlers', () => {
    const { ws } = setupConnecting(`<button id="b" p-trigger="click:stack">x</button>`)

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    ws.serverOpen()

    const uiEvents = sentMessages(ws).filter((m) => m.type === 'ui_event')
    expect(uiEvents.length).toBe(2) // exactly 2, not 4
  })

  test('does not tear down a CONNECTING socket on concurrent sends', () => {
    const { ws } = setupConnecting(`<button id="b" p-trigger="click:guard">x</button>`)
    expect(FakeWebSocket.instances.length).toBe(1)

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    // Still only one socket instance — the connecting socket was reused
    expect(FakeWebSocket.instances.length).toBe(1)
    expect(ws.readyState).toBe(FakeWebSocket.CONNECTING)
  })

  test('does not send synchronously when the socket is CLOSED', () => {
    const { ws } = setupConnecting(`<div p-target="main">x</div>`)
    ws.readyState = FakeWebSocket.CLOSED
    ws.sent.length = 0

    // #reportError -> #send on a non-OPEN socket must queue, not send sync
    ws.serverMessage(renderMessage({ target: 'does-not-exist' }))
    expect(ws.sent.length).toBe(0)
  })
})

// ─── WebSocket retry behavior ───────────────────────────────────────────────

describe('controller: WebSocket retry', () => {
  // Backoff uses Math.random() for jitter; pin it to 0 so setTimeout fires ~0ms.
  const stubRandom = () => {
    Math.random = () => 0
  }

  const setup = () => {
    stubRandom()
    stubPage(`<div p-target="main">x</div>`)
    const controller = newController()
    controller.connect()
    return { controller, ws: FakeWebSocket.last }
  }

  test('reconnects after a retryable close code (1012)', async () => {
    const { ws } = setup()
    expect(FakeWebSocket.instances.length).toBe(1)
    ws.serverClose(1012)
    await wait(20)
    expect(FakeWebSocket.instances.length).toBe(2)
  })

  test('reconnects after close codes 1006 and 1013', async () => {
    for (const code of [1006, 1013] as const) {
      Math.random = () => 0
      FakeWebSocket.reset()
      stubPage(`<div p-target="main">x</div>`)
      const controller = newController()
      controller.connect()
      FakeWebSocket.last.serverClose(code)
      await wait(20)
      expect(FakeWebSocket.instances.length).toBe(2)
    }
  })

  test('does not reconnect on a non-retryable close code (1000)', async () => {
    const { ws } = setup()
    ws.serverClose(1000)
    await wait(20)
    expect(FakeWebSocket.instances.length).toBe(1)
  })

  test('gives up after UI_CORE_MAX_RETRIES reconnect attempts', async () => {
    const { ws } = setup()
    ws.serverClose(1012)
    await wait(20) // socket1
    FakeWebSocket.last.serverClose(1012)
    await wait(20) // socket2
    FakeWebSocket.last.serverClose(1012)
    await wait(20) // socket3
    FakeWebSocket.last.serverClose(1012) // retryCount now == MAX -> no schedule
    await wait(30)
    expect(FakeWebSocket.instances.length).toBe(UI_CORE_MAX_RETRIES + 1)
  })

  test('resets the retry count after a successful open', async () => {
    const { ws } = setup()
    ws.serverClose(1012)
    await wait(20) // socket1 reconnects
    FakeWebSocket.last.serverOpen() // resets retryCount to 0
    FakeWebSocket.last.serverClose(1012) // should retry again
    await wait(20)
    expect(FakeWebSocket.instances.length).toBe(3) // 0, 1, 2
  })
})

// ─── Render & swap modes ─────────────────────────────────────────────────────

describe('controller: render swap modes', () => {
  const setup = () => {
    stubPage(`<div p-target="main"><p id="original">original</p></div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0
    return { controller, ws }
  }

  test('innerHTML replaces the target children', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ html: '<p id="inner">replaced</p>', swap: 'innerHTML' }))
    expect(document.getElementById('original')).toBeNull()
    expect(document.querySelector('[p-target="main"]')!.innerHTML).toContain('replaced')
  })

  test('a missing swap fails schema validation and reports an error', () => {
    const { ws } = setup()
    // swap is required; omitting it must fail Zod parsing and report an error,
    // rather than silently defaulting to innerHTML.
    ws.serverMessage(renderMessage({ html: '<p>no swap</p>', swap: undefined }))
    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
    expect(document.getElementById('original')).not.toBeNull() // DOM unchanged
  })

  test('afterbegin prepends as the first child', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ html: '<span id="ab">first</span>', swap: 'afterbegin' }))
    const main = document.querySelector('[p-target="main"]')!
    expect(main.firstElementChild?.id).toBe('ab')
  })

  test('beforeend appends as the last child', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ html: '<span id="be">last</span>', swap: 'beforeend' }))
    const main = document.querySelector('[p-target="main"]')!
    expect(main.lastElementChild?.id).toBe('be')
  })

  test('beforebegin inserts as the previous sibling', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ html: '<span id="bb">before</span>', swap: 'beforebegin' }))
    const main = document.querySelector('[p-target="main"]')!
    expect(main.previousElementSibling?.id).toBe('bb')
  })

  test('afterend inserts as the next sibling', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ html: '<span id="ae">after</span>', swap: 'afterend' }))
    const main = document.querySelector('[p-target="main"]')!
    expect(main.nextElementSibling?.id).toBe('ae')
  })

  test('outerHTML replaces the target element itself', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ html: '<div id="outer" p-target="main">replaced</div>', swap: 'outerHTML' }))
    expect(document.getElementById('outer')).not.toBeNull()
    expect(document.getElementById('original')).toBeNull()
  })

  test('reports an error and acks when the target element is missing', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ id: 'missing-target', target: 'nope' }))
    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
    expect((error!.detail as Record<string, unknown>).name).toBe('element_not_found')
    expect((error!.detail as Record<string, unknown>).id).toBe('missing-target')
  })

  test('binds triggers on swapped-in fragments', () => {
    const { ws } = setup()
    ws.serverMessage(
      renderMessage({ html: '<button id="swapped" p-trigger="click:swapped">x</button>', swap: 'innerHTML' }),
    )
    ws.sent.length = 0
    document.getElementById('swapped')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(findSent(ws, 'ui_event')).toBeDefined()
  })
})

// ─── Attrs handler ──────────────────────────────────────────────────────────

describe('controller: attrs handler', () => {
  const setup = () => {
    stubPage(`<div p-target="main" data-removable="old" class="base">target</div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0
    return { ws, main: () => document.querySelector('[p-target="main"]')! }
  }

  const attrsMsg = (attr: Record<string, unknown>) => ({
    type: SERVER_TO_CONTROLLER_EVENTS.attrs,
    detail: { id: 'attrs', target: 'main', attr },
  })

  test('sets a string attribute', () => {
    const { ws, main } = setup()
    ws.serverMessage(attrsMsg({ class: 'active' }))
    expect(main().getAttribute('class')).toBe('active')
  })

  test('sets a number attribute as a string', () => {
    const { ws, main } = setup()
    ws.serverMessage(attrsMsg({ 'data-count': 42 }))
    expect(main().getAttribute('data-count')).toBe('42')
  })

  test('toggles a boolean attribute on with true', () => {
    const { ws, main } = setup()
    ws.serverMessage(attrsMsg({ disabled: true }))
    expect(main().hasAttribute('disabled')).toBe(true)
  })

  test('removes an attribute with null', () => {
    const { ws, main } = setup()
    ws.serverMessage(attrsMsg({ 'data-removable': null }))
    expect(main().hasAttribute('data-removable')).toBe(false)
  })

  test('does not re-set an attribute whose value is unchanged', () => {
    const { ws, main } = setup()
    let setCalls = 0
    const original = main().setAttribute.bind(main())
    main().setAttribute = (name: string, value: string) => {
      setCalls++
      original(name, value)
    }
    ws.serverMessage(attrsMsg({ class: 'base' })) // already 'base'
    expect(setCalls).toBe(0)
    expect(main().getAttribute('class')).toBe('base')
  })

  test('reports an error when the target is missing', () => {
    const { ws } = setup()
    ws.serverMessage({ ...attrsMsg({}), detail: { id: 'attrs-x', target: 'nope', attr: {} } })
    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
    expect((error!.detail as Record<string, unknown>).name).toBe('element_not_found')
  })
})

// ─── dispatch_custom_event handler ───────────────────────────────────────────

describe('controller: dispatch_custom_event handler', () => {
  const setup = () => {
    stubPage(`<div p-target="main">target</div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0
    return { ws, main: () => document.querySelector('[p-target="main"]')! }
  }

  const dispatchMsg = (overrides: Record<string, unknown> = {}) => ({
    type: SERVER_TO_CONTROLLER_EVENTS.dispatch_custom_event,
    detail: {
      id: 'dispatch',
      target: 'main',
      event: { type: 'custom', detail: { hello: 'world' } },
      ...overrides,
    },
  })

  test('dispatches a CustomEvent on the target with detail', () => {
    const { ws, main } = setup()
    let received: CustomEvent | undefined
    main().addEventListener('custom', (e: Event) => {
      received = e as CustomEvent
    })
    ws.serverMessage(dispatchMsg())
    expect(received).toBeDefined()
    expect(received!.type).toBe('custom')
    expect(received!.detail).toEqual({ hello: 'world' })
    expect(received!.bubbles).toBe(false)
    expect(received!.composed).toBe(true)
    expect(received!.cancelable).toBe(true)
  })

  test('honors bubbles/cancelable/composed overrides', () => {
    const { ws, main } = setup()
    let received: CustomEvent | undefined
    main().addEventListener('custom', (e: Event) => {
      received = e as CustomEvent
    })
    ws.serverMessage(dispatchMsg({ bubbles: true, cancelable: false, composed: false }))
    expect(received!.bubbles).toBe(true)
    expect(received!.cancelable).toBe(false)
    expect(received!.composed).toBe(false)
  })

  test('reports an error when the target is missing', () => {
    const { ws } = setup()
    ws.serverMessage(dispatchMsg({ target: 'nope' }))
    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
    expect((error!.detail as Record<string, unknown>).name).toBe('element_not_found')
  })
})

// ─── navigate handler ─────────────────────────────────────────────────────────

describe('controller: navigate handler', () => {
  const setup = () => {
    stubPage(`<div p-target="main">target</div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0
    locationCalls.length = 0
    return { ws }
  }

  const navigateMsg = (overrides: Record<string, unknown> = {}) => ({
    type: SERVER_TO_CONTROLLER_EVENTS.navigate,
    detail: { id: 'nav', url: '/destination', ...overrides },
  })

  test('calls window.location.assign by default', () => {
    const { ws } = setup()
    ws.serverMessage(navigateMsg())
    expect(locationCalls).toEqual(['assign:/destination'])
  })

  test('calls window.location.replace when replace is true', () => {
    const { ws } = setup()
    ws.serverMessage(navigateMsg({ url: '/elsewhere', replace: true }))
    expect(locationCalls).toEqual(['replace:/elsewhere'])
  })

  test('acks the navigate message with a success envelope', () => {
    const { ws } = setup()
    ws.serverMessage(navigateMsg({ id: 'nav-ack' }))
    const success = findSent(ws, 'success')
    expect(success).toBeDefined()
    expect((success!.detail as Record<string, unknown>).id).toBe('nav-ack')
  })

  test('does not call assign when replace is true', () => {
    const { ws } = setup()
    ws.serverMessage(navigateMsg({ replace: true }))
    expect(locationCalls.some((c) => c.startsWith('assign:'))).toBe(false)
  })

  test('does not call replace when replace is omitted', () => {
    const { ws } = setup()
    ws.serverMessage(navigateMsg())
    expect(locationCalls.some((c) => c.startsWith('replace:'))).toBe(false)
  })
})

// ─── Stylesheet adoption ─────────────────────────────────────────────────────

describe('controller: document stylesheets', () => {
  const setup = () => {
    stubPage(`<div p-target="main">target</div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0
    return { ws }
  }

  test('adopts render stylesheets onto the document', async () => {
    const { ws } = setup()
    const before = document.adoptedStyleSheets.length
    ws.serverMessage(renderMessage({ html: '<p>x</p>', stylesheets: ['.a{color:red}'] }))
    await wait(10)
    expect(document.adoptedStyleSheets.length).toBe(before + 1)
  })

  test('does not re-adopt a stylesheet already in the cache', async () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ html: '<p>x</p>', stylesheets: ['.dup{color:red}'] }))
    await wait(10)
    const afterFirst = document.adoptedStyleSheets.length
    // Same stylesheet string again (even across a second render)
    ws.serverMessage(renderMessage({ html: '<p>y</p>', stylesheets: ['.dup{color:red}'] }))
    await wait(10)
    expect(document.adoptedStyleSheets.length).toBe(afterFirst)
  })
})

// ─── p-trigger routing ───────────────────────────────────────────────────────

describe('controller: p-trigger routing', () => {
  test('emits a ui_event with the action type and element attributes', () => {
    stubPage(`<div p-target="main"><button id="b" data-x="1" p-trigger="click:go">x</button></div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const uiEvent = findSent(ws, 'ui_event')!
    const detail = uiEvent.detail as Record<string, unknown>
    const bpEvent = detail.event as Record<string, unknown>
    expect(bpEvent.type).toBe('go')
    const attrs = bpEvent.detail as Record<string, string>
    expect(attrs.id).toBe('b')
    expect(attrs['data-x']).toBe('1')
    expect(attrs['p-trigger']).toBe('click:go')
  })

  test('routes multiple event types on one element to their own actions', () => {
    stubPage(`<div p-target="main"><button id="b" p-trigger="click:clicked keydown:pressed">x</button></div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    document.getElementById('b')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))

    const events = sentMessages(ws).filter((m) => m.type === 'ui_event')
    const types = events.map((m) => ((m.detail as Record<string, unknown>).event as Record<string, unknown>).type)
    expect(types).toEqual(['clicked', 'pressed'])
  })

  test('ignores malformed trigger pairs', () => {
    stubPage(`<div p-target="main"><button id="b" p-trigger="click:ok :bad nocolon">x</button></div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    // Only "click:ok" is valid; the malformed pairs are skipped (no throw)
    const uiEvent = findSent(ws, 'ui_event')!
    expect(((uiEvent.detail as Record<string, unknown>).event as Record<string, unknown>).type).toBe('ok')
  })
})

// ─── Extensions ──────────────────────────────────────────────────────────────

describe('controller: extensions', () => {
  test('invokes the matching extension instead of emitting a ui_event', () => {
    const calls: unknown[] = []
    const extensions = new Map([
      [
        'click:ext',
        (params: unknown) => {
          calls.push(params)
        },
      ],
    ])
    stubPage(`<div p-target="main"><button id="b" p-trigger="click:ext">x</button></div>`)
    const controller = newController({ extensions })
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(calls.length).toBe(1)
    // No ui_event emitted because the extension handled it
    expect(findSent(ws, 'ui_event')).toBeUndefined()
  })

  test('passes event, trigger, and addDisconnect to the extension', () => {
    const params: { event: Event; trigger: unknown; addDisconnect: unknown } = {} as never
    const extensions = new Map([
      [
        'click:ext',
        (p: { event: Event; trigger: unknown; addDisconnect: unknown }) => {
          Object.assign(params, p)
        },
      ],
    ])
    stubPage(`<div p-target="main"><button id="b" p-trigger="click:ext">x</button></div>`)
    const controller = newController({ extensions })
    controller.connect()
    FakeWebSocket.last.serverOpen()

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(params.event).toBeInstanceOf(MouseEvent)
    expect(typeof params.trigger).toBe('function')
    expect(typeof params.addDisconnect).toBe('function')
  })

  test('extension trigger() emits a ui_event', () => {
    const extensions = new Map([
      [
        'click:ext',
        ({ trigger }: { trigger: (e: { type: string }) => void }) => {
          trigger({ type: 'from_ext' })
        },
      ],
    ])
    stubPage(`<div p-target="main"><button id="b" p-trigger="click:ext">x</button></div>`)
    const controller = newController({ extensions })
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0

    document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    const uiEvent = findSent(ws, 'ui_event')!
    expect(((uiEvent.detail as Record<string, unknown>).event as Record<string, unknown>).type).toBe('from_ext')
  })

  test('an extension throw is caught and reported, not leaked', () => {
    const extensions = new Map([
      [
        'click:ext',
        () => {
          throw new Error('boom')
        },
      ],
    ])
    stubPage(`<div p-target="main"><button id="b" p-trigger="click:ext">x</button></div>`)
    const controller = newController({ extensions })
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0

    expect(() => document.getElementById('b')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))).not.toThrow()

    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
  })
})

// ─── Form submission (fetch POST) ─────────────────────────────────────────────

describe('controller: form submit', () => {
  const setup = () => {
    stubPage(
      `<div p-target="main"><form id="f" p-form="register" method="post"><input name="name" value="Ada"><button type="submit">go</button></form></div>`,
    )
    const fetchCalls: { url: string; init: RequestInit }[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), init: init ?? {} })
      return new Response('OK', { status: 200 })
    }) as typeof fetch
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0
    return { ws, fetchCalls, form: () => document.getElementById('f') as HTMLFormElement }
  }

  test('POSTs the form data to window.location.href with a p-form-trigger header', async () => {
    const { fetchCalls, form } = setup()
    const event = new SubmitEvent('submit', { bubbles: true, cancelable: true })
    form().dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
    // fetch is called synchronously up to the await; assert after a microtask
    await Promise.resolve()
    expect(fetchCalls.length).toBe(1)
    // The controller POSTs to the current page URL, distinguished by the
    // p-form-trigger header carrying the form's p-form value.
    expect(fetchCalls[0]!.url).toBe(window.location.href)
    expect(fetchCalls[0]!.init.method).toBe('POST')
    expect(fetchCalls[0]!.init.body).toBeInstanceOf(FormData)
    expect((fetchCalls[0]!.init.body as FormData).get('name')).toBe('Ada')
    const headers = fetchCalls[0]!.init.headers as Record<string, string>
    expect(headers[P_FORM_TRIGGER]).toBe('register')
  })

  test('only binds forms that have a p-form attribute', async () => {
    // A form WITHOUT p-form is not controller-managed: no fetch, no preventDefault.
    stubPage(`<div p-target="main"><form id="bare" action="/x" method="post"><input name="n" value="1"></form></div>`)
    const fetchCalls: { url: string; init: RequestInit }[] = []
    globalThis.fetch = (async () => new Response('OK', { status: 200 })) as unknown as typeof fetch
    const controller = newController()
    controller.connect()
    const event = new SubmitEvent('submit', { bubbles: true, cancelable: true })
    document.getElementById('bare')!.dispatchEvent(event)
    await Promise.resolve()
    expect(fetchCalls.length).toBe(0)
    expect(event.defaultPrevented).toBe(false)
  })

  test('reports an error when the fetch fails', async () => {
    globalThis.fetch = (async () => new Response('nope', { status: 500 })) as unknown as typeof fetch
    stubPage(`<div p-target="main"><form id="f" p-form="save" method="post"><input name="x" value="1"></form></div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0

    document.getElementById('f')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    await wait(10)

    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
    expect((error!.detail as Record<string, unknown>).name).toBe('form_submit')
  })
  test('ignores non-SubmitEvent events on a form (guard)', async () => {
    const { fetchCalls, form } = setup()
    // A non-submit event must be ignored by the isSubmit guard: no fetch,
    // no preventDefault, no error.
    const event = new Event('submit', { bubbles: true, cancelable: true })
    form().dispatchEvent(event)
    await Promise.resolve()
    expect(fetchCalls.length).toBe(0)
    expect(event.defaultPrevented).toBe(false)
  })
})

// ─── Error reporting & success ack ────────────────────────────────────────────

describe('controller: error reporting & success ack', () => {
  const setup = () => {
    stubPage(`<div p-target="main">target</div>`)
    const controller = newController()
    controller.connect()
    const ws = FakeWebSocket.last
    ws.serverOpen()
    ws.sent.length = 0
    return { ws }
  }

  test('acks a successful server message with a success envelope', () => {
    const { ws } = setup()
    ws.serverMessage(renderMessage({ id: 'ack-me' }))
    const success = findSent(ws, 'success')!
    expect(success).toBeDefined()
    expect((success.detail as Record<string, unknown>).id).toBe('ack-me')
    expect(typeof (success.detail as Record<string, unknown>).timeStamp).toBe('number')
  })

  test('reports an error with name and stack when a message is unparseable JSON', () => {
    const { ws } = setup()
    // Push raw invalid JSON straight through the message path
    ws.serverMessage('{ not json')
    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
    expect((error!.detail as Record<string, unknown>).name).toBeDefined()
  })

  test('reports an error when a message fails schema validation', () => {
    const { ws } = setup()
    ws.serverMessage({ type: 'totally_unknown', detail: { id: 'x' } })
    const error = findSent(ws, 'error')
    expect(error).toBeDefined()
  })
})
