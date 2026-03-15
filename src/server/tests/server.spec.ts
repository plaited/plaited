import { afterAll, describe, expect, test } from 'bun:test'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../../events.ts'
import { DEFAULT_CSP, SERVER_ERRORS } from '../server.constants.ts'
import { createServer } from '../server.ts'
import type { ServerHandle } from '../server.types.ts'

// ── Helpers ────────────────────────────────────────────────────────────────────

type TriggeredEvent = { type: string; detail?: unknown }

const createTestServer = (overrides: Partial<Parameters<typeof createServer>[0]> = {}) => {
  const triggered: TriggeredEvent[] = []
  const trigger = (evt: TriggeredEvent) => {
    triggered.push(evt)
  }
  const handle = createServer({
    trigger,
    routes: overrides.routes ?? {},
    validateSession: () => true,
    port: 0,
    ...overrides,
  })
  return { ...handle, triggered }
}

const wsUrl = (port: number) => `ws://localhost:${port}/ws`
const httpUrl = (port: number, path: string) => `http://localhost:${port}${path}`

const SESSION_COOKIE = 'sid=test-session-id'

/** Open a WebSocket with session cookie, protocol, and optional origin */
const openWs = (port: number, opts: { cookie?: string; origin?: string; protocol?: string } = {}) => {
  const headers: Record<string, string> = {
    Cookie: opts.cookie ?? SESSION_COOKIE,
  }
  if (opts.origin) headers.Origin = opts.origin
  if (opts.protocol) headers['Sec-WebSocket-Protocol'] = opts.protocol
  // @ts-expect-error — Bun extends WebSocket constructor with headers option
  return new WebSocket(wsUrl(port), { headers }) as WebSocket
}

/** Wait for a WebSocket to reach open state */
const waitForOpen = (ws: WebSocket) =>
  new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = (e) => reject(e)
  })

/** Wait for a WebSocket to reach closed state */
const waitForClose = (ws: WebSocket) =>
  new Promise<void>((resolve) => {
    ws.onclose = () => resolve()
  })

/** Collect a single message from the WebSocket */
const nextMessage = (ws: WebSocket) =>
  new Promise<unknown>((resolve) => {
    ws.onmessage = (e) => resolve(JSON.parse(String(e.data)))
  })

// ─── Server Setup ─────────────────────────────────────────────────────────────

describe('Server Setup', () => {
  let handle: ServerHandle
  afterAll(async () => {
    handle.stop(true)
  })

  test('creates on random port and returns ServerHandle', () => {
    const result = createTestServer()
    handle = result
    expect(result.port).toBeGreaterThan(0)
    // Raw Bun.Server accessible via .server
    expect(typeof handle.server.publish).toBe('function')
    // ServerHandle API
    expect(typeof handle.send).toBe('function')
    expect(typeof handle.stop).toBe('function')
  })

  test('serves caller-provided routes', async () => {
    const result = createTestServer({
      routes: {
        '/health': new Response('OK'),
        '/api/status': new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    })
    afterAll(() => result.stop(true))

    const health = await fetch(httpUrl(result.port, '/health'))
    expect(health.status).toBe(200)
    expect(await health.text()).toBe('OK')

    const status = await fetch(httpUrl(result.port, '/api/status'))
    expect(status.status).toBe(200)
    expect(await status.json()).toEqual({ ok: true })
  })
})

// ─── WebSocket Upgrade ────────────────────────────────────────────────────────

describe('WebSocket Upgrade', () => {
  let port: number
  let handle: ServerHandle
  let triggered: TriggeredEvent[]

  afterAll(() => {
    handle.stop(true)
  })

  test('setup', () => {
    const result = createTestServer({
      allowedOrigins: new Set(['http://localhost:3000']),
    })
    handle = result
    port = result.port
    triggered = result.triggered
  })

  test('missing session rejects with 401 and triggers error', async () => {
    const res = await fetch(httpUrl(port, '/ws'), {
      headers: {
        Upgrade: 'websocket',
        Origin: 'http://localhost:3000',
      },
    })
    expect(res.status).toBe(401)
    const body = await res.text()
    expect(body).toBe(SERVER_ERRORS.session_missing)

    const errorEvt = triggered.find(
      (e) =>
        e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_error &&
        (e.detail as { code: string })?.code === SERVER_ERRORS.session_missing,
    )
    expect(errorEvt).toBeDefined()
  })

  test('disallowed origin rejects with 403 and triggers error', async () => {
    const res = await fetch(httpUrl(port, '/ws'), {
      headers: {
        Upgrade: 'websocket',
        Cookie: SESSION_COOKIE,
        Origin: 'http://evil.example.com',
      },
    })
    expect(res.status).toBe(403)
    const body = await res.text()
    expect(body).toBe(SERVER_ERRORS.origin_rejected)

    const errorEvt = triggered.find(
      (e) =>
        e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_error &&
        (e.detail as { code: string })?.code === SERVER_ERRORS.origin_rejected,
    )
    expect(errorEvt).toBeDefined()
  })

  test('missing protocol rejects with 400 and triggers error', async () => {
    const res = await fetch(httpUrl(port, '/ws'), {
      headers: {
        Upgrade: 'websocket',
        Cookie: SESSION_COOKIE,
        Origin: 'http://localhost:3000',
      },
    })
    expect(res.status).toBe(400)
    const body = await res.text()
    expect(body).toBe(SERVER_ERRORS.protocol_missing)

    const errorEvt = triggered.find(
      (e) =>
        e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_error &&
        (e.detail as { code: string })?.code === SERVER_ERRORS.protocol_missing,
    )
    expect(errorEvt).toBeDefined()
  })

  test('valid upgrade with protocol connects and echoes protocol', async () => {
    const ws = openWs(port, {
      origin: 'http://localhost:3000',
      protocol: 'document',
    })
    await waitForOpen(ws)
    expect(ws.readyState).toBe(WebSocket.OPEN)
    // Bun WebSocket client receives negotiated protocol
    expect(ws.protocol).toBe('document')
    ws.close()
  })

  test('missing origin rejected when allowedOrigins is set', async () => {
    const res = await fetch(httpUrl(port, '/ws'), {
      headers: {
        Upgrade: 'websocket',
        Cookie: SESSION_COOKIE,
        // No Origin header
      },
    })
    expect(res.status).toBe(403)
    const body = await res.text()
    expect(body).toBe(SERVER_ERRORS.origin_rejected)
  })
})

// ─── WebSocket Lifecycle ──────────────────────────────────────────────────────

describe('WebSocket Lifecycle', () => {
  let port: number
  let handle: ServerHandle
  let triggered: TriggeredEvent[]

  afterAll(() => {
    handle.stop(true)
  })

  test('setup', () => {
    const result = createTestServer()
    handle = result
    port = result.port
    triggered = result.triggered
  })

  test('client_connected triggered on open with sessionId, source, and isReconnect', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const connectEvt = triggered.find((e) => e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_connected)
    expect(connectEvt).toBeDefined()
    const detail = connectEvt!.detail as { sessionId: string; source: string; isReconnect: boolean }
    expect(detail.sessionId).toBe('test-session-id')
    expect(detail.source).toBe('document')
    expect(detail.isReconnect).toBe(false)
    ws.close()
  })

  test('client_disconnected triggered on close with code and reason', async () => {
    const before = triggered.length
    const ws = openWs(port, { protocol: 'my-island' })
    await waitForOpen(ws)
    ws.close()
    await Bun.sleep(50)

    const disconnectEvt = triggered
      .slice(before)
      .find((e) => e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected)
    expect(disconnectEvt).toBeDefined()
    const detail = disconnectEvt!.detail as { sessionId: string; code: number; reason: string }
    expect(detail.sessionId).toBe('test-session-id')
    expect(typeof detail.code).toBe('number')
    expect(typeof detail.reason).toBe('string')
  })

  test('document source subscribes to sessionId topic', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const messagePromise = nextMessage(ws)
    handle.server.publish(
      'test-session-id',
      JSON.stringify({ type: 'render', detail: { target: 'main', html: '<p>hello</p>' } }),
    )

    const msg = (await messagePromise) as { type: string; detail: { html: string } }
    expect(msg.type).toBe('render')
    expect(msg.detail.html).toBe('<p>hello</p>')
    ws.close()
  })

  test('island source subscribes to sessionId:tagName topic', async () => {
    const ws = openWs(port, { protocol: 'app-shell' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const messagePromise = nextMessage(ws)
    handle.server.publish(
      'test-session-id:app-shell',
      JSON.stringify({ type: 'attrs', detail: { target: 'main', attr: { class: 'active' } } }),
    )

    const msg = (await messagePromise) as { type: string }
    expect(msg.type).toBe('attrs')
    ws.close()
  })
})

// ─── SSR Reconciliation ─────────────────────────────────────────────────────

describe('SSR Reconciliation', () => {
  let port: number
  let handle: ServerHandle
  let triggered: TriggeredEvent[]

  afterAll(() => {
    handle.stop(true)
  })

  test('setup', () => {
    const result = createTestServer()
    handle = result
    port = result.port
    triggered = result.triggered
  })

  test('first connection for a session has isReconnect false', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const connectEvt = triggered.find((e) => e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_connected)
    expect(connectEvt).toBeDefined()
    const detail = connectEvt!.detail as { isReconnect: boolean }
    expect(detail.isReconnect).toBe(false)
    ws.close()
    await waitForClose(ws)
    await Bun.sleep(50)
  })

  test('subsequent connection for same session has isReconnect true', async () => {
    const before = triggered.length
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const connectEvt = triggered.slice(before).find((e) => e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_connected)
    expect(connectEvt).toBeDefined()
    const detail = connectEvt!.detail as { isReconnect: boolean }
    expect(detail.isReconnect).toBe(true)
    ws.close()
  })

  test('different source on same session still detects reconnection', async () => {
    const before = triggered.length
    // Same session (same cookie) but different source (island vs document)
    const ws = openWs(port, { protocol: 'sidebar-island' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const connectEvt = triggered.slice(before).find((e) => e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_connected)
    expect(connectEvt).toBeDefined()
    const detail = connectEvt!.detail as { isReconnect: boolean; source: string }
    // Same sessionId seen before → isReconnect true regardless of source
    expect(detail.isReconnect).toBe(true)
    expect(detail.source).toBe('sidebar-island')
    ws.close()
  })
})

// ─── MPA View Transition Replay Buffer ──────────────────────────────────────

describe('MPA View Transition Replay Buffer', () => {
  let port: number
  let handle: ServerHandle

  afterAll(() => {
    handle.stop(true)
  })

  test('setup', () => {
    const result = createTestServer({
      replayBuffer: { maxSize: 5, ttlMs: 2000 },
    })
    handle = result
    port = result.port
  })

  test('send() delivers immediately when connected', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const messagePromise = nextMessage(ws)
    handle.send('test-session-id', JSON.stringify({ type: 'render', detail: { target: 'main', html: '<p>live</p>' } }))

    const msg = (await messagePromise) as { type: string; detail: { html: string } }
    expect(msg.type).toBe('render')
    expect(msg.detail.html).toBe('<p>live</p>')
    ws.close()
    await waitForClose(ws)
    await Bun.sleep(50)
  })

  test('messages sent during connection gap are replayed on reconnect', async () => {
    // Previous test closed the connection — no subscribers on this topic
    const msg1 = JSON.stringify({ type: 'render', detail: { target: 'main', html: '<p>buffered-1</p>' } })
    const msg2 = JSON.stringify({ type: 'attrs', detail: { target: 'nav', attr: { class: 'active' } } })
    handle.send('test-session-id', msg1)
    handle.send('test-session-id', msg2)

    // Reconnect — should receive buffered messages
    const ws = openWs(port, { protocol: 'document' })
    const received: unknown[] = []
    ws.onmessage = (e) => received.push(JSON.parse(String(e.data)))
    await waitForOpen(ws)
    await Bun.sleep(100)

    expect(received).toHaveLength(2)
    expect((received[0] as { detail: { html: string } }).detail.html).toBe('<p>buffered-1</p>')
    expect((received[1] as { type: string }).type).toBe('attrs')
    ws.close()
    await waitForClose(ws)
    await Bun.sleep(50)
  })

  test('expired messages are not replayed', async () => {
    // Send a message while disconnected
    handle.send(
      'test-session-id',
      JSON.stringify({ type: 'render', detail: { target: 'main', html: '<p>expired</p>' } }),
    )

    // Wait for TTL to expire (configured to 2000ms)
    await Bun.sleep(2100)

    // Reconnect — expired message should NOT be replayed
    const ws = openWs(port, { protocol: 'document' })
    const received: unknown[] = []
    ws.onmessage = (e) => received.push(JSON.parse(String(e.data)))
    await waitForOpen(ws)
    await Bun.sleep(100)

    expect(received).toHaveLength(0)
    ws.close()
    await waitForClose(ws)
    await Bun.sleep(50)
  })

  test('buffer respects maxSize limit', async () => {
    // Buffer more than maxSize (5) messages while disconnected
    for (let i = 0; i < 8; i++) {
      handle.send(
        'test-session-id',
        JSON.stringify({ type: 'render', detail: { target: 'main', html: `<p>msg-${i}</p>` } }),
      )
    }

    // Reconnect — should receive only last 5 messages
    const ws = openWs(port, { protocol: 'document' })
    const received: unknown[] = []
    ws.onmessage = (e) => received.push(JSON.parse(String(e.data)))
    await waitForOpen(ws)
    await Bun.sleep(100)

    expect(received).toHaveLength(5)
    // First message should be msg-3 (oldest 3 were dropped)
    expect((received[0] as { detail: { html: string } }).detail.html).toBe('<p>msg-3</p>')
    ws.close()
  })

  test('island topics buffer independently', async () => {
    // Buffer messages on two different island topics
    handle.send(
      'test-session-id:app-shell',
      JSON.stringify({ type: 'render', detail: { target: 'header', html: '<h1>Shell</h1>' } }),
    )
    handle.send(
      'test-session-id:sidebar',
      JSON.stringify({ type: 'render', detail: { target: 'nav', html: '<nav>Links</nav>' } }),
    )

    // Connect only the app-shell island
    const ws = openWs(port, { protocol: 'app-shell' })
    const received: unknown[] = []
    ws.onmessage = (e) => received.push(JSON.parse(String(e.data)))
    await waitForOpen(ws)
    await Bun.sleep(100)

    // Only app-shell messages should be replayed
    expect(received).toHaveLength(1)
    expect((received[0] as { detail: { html: string } }).detail.html).toBe('<h1>Shell</h1>')
    ws.close()
  })
})

// ─── Message Forwarding ─────────────────────────────────────────────────────

describe('Message Forwarding', () => {
  let port: number
  let handle: ServerHandle
  let triggered: TriggeredEvent[]

  afterAll(() => {
    handle.stop(true)
  })

  test('setup', () => {
    const result = createTestServer()
    handle = result
    port = result.port
    triggered = result.triggered
  })

  test('valid user_action forwarded via trigger', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)

    ws.send(
      JSON.stringify({
        type: 'user_action',
        detail: { id: 'test-1', source: 'my-island', msg: 'click_button' },
      }),
    )
    await Bun.sleep(50)

    const actionEvt = triggered.find((e) => e.type === 'user_action')
    expect(actionEvt).toBeDefined()
    ws.close()
  })

  test('valid snapshot forwarded via trigger', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)

    ws.send(
      JSON.stringify({
        type: 'snapshot',
        detail: {
          id: 'snap-1',
          source: 'document',
          msg: {
            kind: 'selection',
            bids: [{ type: 'test_event', thread: 'test', trigger: false, selected: true, priority: 0 }],
          },
        },
      }),
    )
    await Bun.sleep(50)

    const snapEvt = triggered.find((e) => e.type === 'snapshot')
    expect(snapEvt).toBeDefined()
    ws.close()
  })

  test('malformed JSON triggers error event', async () => {
    const before = triggered.length
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)

    ws.send('not json at all')
    await Bun.sleep(50)

    const errorEvt = triggered
      .slice(before)
      .find(
        (e) =>
          e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_error &&
          (e.detail as { code: string })?.code === SERVER_ERRORS.malformed_message,
      )
    expect(errorEvt).toBeDefined()
    ws.close()
  })

  test('schema-invalid message triggers error event', async () => {
    const before = triggered.length
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)

    ws.send(JSON.stringify({ type: 'unknown_event', detail: 42 }))
    await Bun.sleep(50)

    const errorEvt = triggered
      .slice(before)
      .find(
        (e) =>
          e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_error &&
          (e.detail as { code: string })?.code === SERVER_ERRORS.malformed_message,
      )
    expect(errorEvt).toBeDefined()
    ws.close()
  })
})

// ─── Fetch Fallthrough ──────────────────────────────────────────────────────

describe('Fetch Fallthrough', () => {
  let port: number
  let handle: ServerHandle
  let triggered: TriggeredEvent[]

  afterAll(() => {
    handle.stop(true)
  })

  test('setup', () => {
    const result = createTestServer({
      routes: { '/health': new Response('OK') },
    })
    handle = result
    port = result.port
    triggered = result.triggered
  })

  test('unknown path returns 404 and triggers error', async () => {
    const before = triggered.length
    const res = await fetch(httpUrl(port, '/nonexistent'))
    expect(res.status).toBe(404)

    const errorEvt = triggered
      .slice(before)
      .find(
        (e) =>
          e.type === UI_ADAPTER_LIFECYCLE_EVENTS.client_error &&
          (e.detail as { code: string })?.code === SERVER_ERRORS.not_found,
      )
    expect(errorEvt).toBeDefined()
    expect((errorEvt!.detail as { pathname: string }).pathname).toBe('/nonexistent')
  })

  test('no 405 — unmatched paths return 404 not 405', async () => {
    const res = await fetch(httpUrl(port, '/does-not-exist'))
    expect(res.status).toBe(404)
  })
})

// ─── CSP Security Headers ────────────────────────────────────────────────────

describe('CSP Security Headers', () => {
  test('default CSP header present on 404 response', async () => {
    const result = createTestServer()
    afterAll(() => result.stop(true))

    const res = await fetch(httpUrl(result.port, '/nonexistent'))
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Security-Policy')).toBe(DEFAULT_CSP)
  })

  test('default CSP header present on 401 response', async () => {
    const result = createTestServer()
    afterAll(() => result.stop(true))

    const res = await fetch(httpUrl(result.port, '/ws'), {
      headers: { Upgrade: 'websocket' },
    })
    expect(res.status).toBe(401)
    expect(res.headers.get('Content-Security-Policy')).toBe(DEFAULT_CSP)
  })

  test('default CSP header present on 403 response', async () => {
    const result = createTestServer({
      allowedOrigins: new Set(['http://localhost:3000']),
    })
    afterAll(() => result.stop(true))

    const res = await fetch(httpUrl(result.port, '/ws'), {
      headers: {
        Upgrade: 'websocket',
        Cookie: SESSION_COOKIE,
        Origin: 'http://evil.example.com',
      },
    })
    expect(res.status).toBe(403)
    expect(res.headers.get('Content-Security-Policy')).toBe(DEFAULT_CSP)
  })

  test('custom CSP string overrides default', async () => {
    const customCsp = "default-src 'none'; connect-src 'self'"
    const result = createTestServer({ csp: customCsp })
    afterAll(() => result.stop(true))

    const res = await fetch(httpUrl(result.port, '/nonexistent'))
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Security-Policy')).toBe(customCsp)
  })

  test('csp: false disables CSP header entirely', async () => {
    const result = createTestServer({ csp: false })
    afterAll(() => result.stop(true))

    const res = await fetch(httpUrl(result.port, '/nonexistent'))
    expect(res.status).toBe(404)
    expect(res.headers.get('Content-Security-Policy')).toBeNull()
  })
})
