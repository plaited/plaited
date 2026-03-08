import { afterAll, describe, expect, test } from 'bun:test'
import { CLIENT_LIFECYCLE_EVENTS } from '../../events.ts'
import { SERVER_ERRORS } from '../server.constants.ts'
import { createServer } from '../server.ts'

// ── Helpers ────────────────────────────────────────────────────────────────────

type TriggeredEvent = { type: string; detail?: unknown }

const createTestServer = (overrides: Partial<Parameters<typeof createServer>[0]> = {}) => {
  const triggered: TriggeredEvent[] = []
  const trigger = (evt: TriggeredEvent) => {
    triggered.push(evt)
  }
  const server = createServer({
    trigger,
    routes: overrides.routes ?? {},
    port: 0,
    ...overrides,
  })
  // port is always defined when Bun.serve() succeeds with port: 0
  return { server, port: server.port!, triggered }
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

/** Collect a single message from the WebSocket */
const nextMessage = (ws: WebSocket) =>
  new Promise<unknown>((resolve) => {
    ws.onmessage = (e) => resolve(JSON.parse(String(e.data)))
  })

// ─── Server Setup ─────────────────────────────────────────────────────────────

describe('Server Setup', () => {
  let server: ReturnType<typeof createServer>
  afterAll(async () => {
    server.stop(true)
  })

  test('creates on random port and returns raw Bun.Server', () => {
    const result = createTestServer()
    server = result.server
    expect(result.port).toBeGreaterThan(0)
    // It's a raw Bun.Server — has publish, stop, etc.
    expect(typeof server.publish).toBe('function')
    expect(typeof server.stop).toBe('function')
  })

  test('serves caller-provided routes', async () => {
    const { server: s, port } = createTestServer({
      routes: {
        '/health': new Response('OK'),
        '/api/status': new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        }),
      },
    })
    afterAll(() => s.stop(true))

    const health = await fetch(httpUrl(port, '/health'))
    expect(health.status).toBe(200)
    expect(await health.text()).toBe('OK')

    const status = await fetch(httpUrl(port, '/api/status'))
    expect(status.status).toBe(200)
    expect(await status.json()).toEqual({ ok: true })
  })
})

// ─── WebSocket Upgrade ────────────────────────────────────────────────────────

describe('WebSocket Upgrade', () => {
  let port: number
  let server: ReturnType<typeof createServer>
  let triggered: TriggeredEvent[]

  afterAll(() => {
    server.stop(true)
  })

  test('setup', () => {
    const result = createTestServer({
      allowedOrigins: new Set(['http://localhost:3000']),
    })
    server = result.server
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
        e.type === CLIENT_LIFECYCLE_EVENTS.client_error &&
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
        e.type === CLIENT_LIFECYCLE_EVENTS.client_error &&
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
        e.type === CLIENT_LIFECYCLE_EVENTS.client_error &&
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
})

// ─── WebSocket Lifecycle ──────────────────────────────────────────────────────

describe('WebSocket Lifecycle', () => {
  let port: number
  let server: ReturnType<typeof createServer>
  let triggered: TriggeredEvent[]

  afterAll(() => {
    server.stop(true)
  })

  test('setup', () => {
    const result = createTestServer()
    server = result.server
    port = result.port
    triggered = result.triggered
  })

  test('client_connected triggered on open with sessionId and source', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const connectEvt = triggered.find((e) => e.type === CLIENT_LIFECYCLE_EVENTS.client_connected)
    expect(connectEvt).toBeDefined()
    const detail = connectEvt!.detail as { sessionId: string; source: string }
    expect(detail.sessionId).toBe('test-session-id')
    expect(detail.source).toBe('document')
    ws.close()
  })

  test('client_disconnected triggered on close', async () => {
    const before = triggered.length
    const ws = openWs(port, { protocol: 'my-island' })
    await waitForOpen(ws)
    ws.close()
    await Bun.sleep(50)

    const disconnectEvt = triggered.slice(before).find((e) => e.type === CLIENT_LIFECYCLE_EVENTS.client_disconnected)
    expect(disconnectEvt).toBeDefined()
    const detail = disconnectEvt!.detail as { sessionId: string }
    expect(detail.sessionId).toBe('test-session-id')
  })

  test('document source subscribes to sessionId topic', async () => {
    const ws = openWs(port, { protocol: 'document' })
    await waitForOpen(ws)
    await Bun.sleep(50)

    const messagePromise = nextMessage(ws)
    server.publish(
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
    server.publish(
      'test-session-id:app-shell',
      JSON.stringify({ type: 'attrs', detail: { target: 'main', attr: { class: 'active' } } }),
    )

    const msg = (await messagePromise) as { type: string }
    expect(msg.type).toBe('attrs')
    ws.close()
  })
})

// ─── Message Forwarding ─────────────────────────────────────────────────────

describe('Message Forwarding', () => {
  let port: number
  let server: ReturnType<typeof createServer>
  let triggered: TriggeredEvent[]

  afterAll(() => {
    server.stop(true)
  })

  test('setup', () => {
    const result = createTestServer()
    server = result.server
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
          e.type === CLIENT_LIFECYCLE_EVENTS.client_error &&
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
          e.type === CLIENT_LIFECYCLE_EVENTS.client_error &&
          (e.detail as { code: string })?.code === SERVER_ERRORS.malformed_message,
      )
    expect(errorEvt).toBeDefined()
    ws.close()
  })
})

// ─── Fetch Fallthrough ──────────────────────────────────────────────────────

describe('Fetch Fallthrough', () => {
  let port: number
  let server: ReturnType<typeof createServer>
  let triggered: TriggeredEvent[]

  afterAll(() => {
    server.stop(true)
  })

  test('setup', () => {
    const result = createTestServer({
      routes: { '/health': new Response('OK') },
    })
    server = result.server
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
          e.type === CLIENT_LIFECYCLE_EVENTS.client_error &&
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
