/**
 * Fixture server for browser tests.
 * Builds entry files with Bun.build(), serves static HTML/JS,
 * and provides a WebSocket that dispatches test messages on open
 * using the subprotocol as source identity.
 */
import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'

const FIXTURES_DIR = import.meta.dir
const DIST_DIR = join(FIXTURES_DIR, 'dist')

// Build controller fixture entry files for browser consumption.
const buildResult = await Bun.build({
  entrypoints: [
    join(FIXTURES_DIR, 'control-island.entry.ts'),
    join(FIXTURES_DIR, 'swap-fixture.entry.ts'),
    join(FIXTURES_DIR, 'module-fixture.entry.ts'),
    join(FIXTURES_DIR, 'test-elements.entry.ts'),
  ],
  outdir: DIST_DIR,
  target: 'browser',
  minify: false,
})

if (!buildResult.success) {
  for (const log of buildResult.logs) {
    console.error(log)
  }
  throw new Error('Build failed')
}

// Build the imported controller module separately, served from /modules/.
const moduleResult = await Bun.build({
  entrypoints: [join(FIXTURES_DIR, 'controller-module.ts'), join(FIXTURES_DIR, 'invalid-controller-module.ts')],
  outdir: join(DIST_DIR, 'modules'),
  target: 'browser',
  minify: false,
})

if (!moduleResult.success) {
  for (const log of moduleResult.logs) {
    console.error(log)
  }
  throw new Error('Module build failed')
}

// ─── Static HTML fixtures ─────────────────────────────────────────────────────

// The fixture keeps wrapper tags as source identities (WebSocket subprotocol values)
// and sets display:contents to preserve layout behavior in static HTML.
const HTML_CONTROL_ISLAND = `<!DOCTYPE html>
<html>
<head>
  <title>Control Island Test</title>
  <style>test-island { display: contents; }</style>
</head>
<body>
  <test-island p-topic="test-island">
    <div p-target="main"><p>initial content</p></div>
  </test-island>
  <script type="module" src="/dist/control-island.entry.js"></script>
</body>
</html>`

const HTML_SWAP_FIXTURE = `<!DOCTYPE html>
<html>
<head>
  <title>Swap Fixture Test</title>
  <style>swap-fixture { display: contents; }</style>
</head>
<body>
  <swap-fixture p-topic="swap-fixture">
    <div p-target="main"><p>initial swap content</p></div>
  </swap-fixture>
  <script type="module" src="/dist/swap-fixture.entry.js"></script>
</body>
</html>`

const HTML_MODULE_FIXTURE = `<!DOCTYPE html>
<html>
<head>
  <title>Controller Module Test</title>
  <style>module-fixture { display: contents; }</style>
</head>
<body>
  <module-fixture p-topic="module-fixture">
    <div p-target="main"><p>initial module content</p></div>
  </module-fixture>
  <script type="module" src="/dist/module-fixture.entry.js"></script>
</body>
</html>`

// ─── Dynamic test page HTML ───────────────────────────────────────────────────

const TEST_PAGE_CONTENT: Record<string, string> = {
  'swap-test': `
    <div p-target="main"><p id="original">original</p></div>
    <div p-target="outer-target">outer original</div>
  `,
  'attrs-test': `
    <div p-target="main" data-removable="old-value"><p>attrs target</p></div>
  `,
  'action-test': `
    <div p-target="main"><p>waiting for action</p></div>
  `,
  'retry-test': `
    <div p-target="main"><p>connecting</p></div>
  `,
  'bad-import-test': `
    <div p-target="main"><p>waiting for bad import</p></div>
  `,
  'unsupported-event-test': `
    <div p-target="main"><p>waiting for unsupported event</p></div>
  `,
}

const generateTestPage = (tag: string) => {
  const content = TEST_PAGE_CONTENT[tag] ?? '<p>test content</p>'
  return `<!DOCTYPE html>
<html>
<head>
  <title>${tag} Test</title>
  <style>${tag} { display: contents; }</style>
</head>
<body>
  <${tag} p-topic="${tag}">
    ${content}
  </${tag}>
  <script type="module" src="/dist/test-elements.entry.js"></script>
</body>
</html>`
}

// ─── Server message templates ─────────────────────────────────────────────────

const RENDER_MESSAGE = JSON.stringify({
  type: 'render',
  detail: {
    target: 'main',
    html: '<div id="ws-rendered">Hello from WebSocket</div>',
  },
})

const DSD_RENDER_MESSAGE = JSON.stringify({
  type: 'render',
  detail: {
    target: 'main',
    html: '<div id="dsd-host"><template shadowrootmode="open"><style>:host { display: block; }</style><p>shadow content</p></template></div>',
    swap: 'innerHTML',
  },
})

const MODULE_RENDER_MESSAGE = JSON.stringify({
  type: 'render',
  detail: {
    target: 'main',
    html: '<button id="module-p-trigger-btn" data-extra="p-trigger-attr" p-trigger="click:test_click">P-trigger Action</button><button id="module-enhanced-btn" data-extra="module-listener">Module Listener</button><div id="module-initial">Module fixture loaded</div>',
    swap: 'innerHTML',
  },
})

// ─── WebSocket message handlers for test elements ─────────────────────────────

const sendSwapTestMessages = (ws: ServerWebSocket<{ source: string }>) => {
  // Step 1: innerHTML — replace children of 'main'
  ws.send(
    JSON.stringify({
      type: 'render',
      detail: { target: 'main', html: '<p id="inner-result">inner replaced</p>', swap: 'innerHTML' },
    }),
  )
  // Step 2: afterbegin — prepend inside 'main'
  ws.send(
    JSON.stringify({
      type: 'render',
      detail: { target: 'main', html: '<span id="afterbegin-result">first</span>', swap: 'afterbegin' },
    }),
  )
  // Step 3: beforeend — append inside 'main'
  ws.send(
    JSON.stringify({
      type: 'render',
      detail: { target: 'main', html: '<span id="beforeend-result">last</span>', swap: 'beforeend' },
    }),
  )
  // Step 4: afterend — insert after 'main' element
  ws.send(
    JSON.stringify({
      type: 'render',
      detail: { target: 'main', html: '<span id="afterend-result">after main</span>', swap: 'afterend' },
    }),
  )
  // Step 5: beforebegin — insert before 'main' element
  ws.send(
    JSON.stringify({
      type: 'render',
      detail: { target: 'main', html: '<span id="beforebegin-result">before main</span>', swap: 'beforebegin' },
    }),
  )
  // Step 6: outerHTML — replace 'outer-target' element itself
  ws.send(
    JSON.stringify({
      type: 'render',
      detail: {
        target: 'outer-target',
        html: '<div id="outer-result" p-target="outer-target">outer replaced</div>',
        swap: 'outerHTML',
      },
    }),
  )
}

const sendAttrsTestMessages = (ws: ServerWebSocket<{ source: string }>) => {
  // Set string attribute
  ws.send(
    JSON.stringify({
      type: 'attrs',
      detail: { target: 'main', attr: { class: 'active' } },
    }),
  )
  // Remove attribute
  ws.send(
    JSON.stringify({
      type: 'attrs',
      detail: { target: 'main', attr: { 'data-removable': null } },
    }),
  )
  // Set boolean attribute
  ws.send(
    JSON.stringify({
      type: 'attrs',
      detail: { target: 'main', attr: { disabled: true } },
    }),
  )
  // Set number attribute
  ws.send(
    JSON.stringify({
      type: 'attrs',
      detail: { target: 'main', attr: { 'data-count': 42 } },
    }),
  )
}

const sendActionTestInitialRender = (ws: ServerWebSocket<{ source: string }>) => {
  ws.send(
    JSON.stringify({
      type: 'render',
      detail: {
        target: 'main',
        html: '<button id="test-btn" p-trigger="click:test_click">Click me</button>',
        swap: 'innerHTML',
      },
    }),
  )
}

// ─── Server ───────────────────────────────────────────────────────────────────

/**
 * Handle returned by the controller browser fixture server.
 */
export type FixtureServer = {
  server: ReturnType<typeof Bun.serve>
  port: number
  stop: () => Promise<void>
  /** Last `ui_event` message received from a controller island. */
  lastUiEvent: { source: string; message: Record<string, unknown> } | undefined
  /** All `ui_event` messages received from controller islands. */
  uiEvents: { source: string; message: Record<string, unknown> }[]
  /** Controller runtime errors received from controller islands. */
  errors: { source: string; message: Record<string, unknown> }[]
}

/**
 * Starts the browser fixture server used by controller integration tests.
 *
 * @param port - TCP port to bind, or `0` to let Bun choose an available port.
 * @returns Fixture server handle with captured client messages and shutdown hook.
 */
export const startServer = (port = 0): FixtureServer => {
  const state: {
    lastUiEvent: { source: string; message: Record<string, unknown> } | undefined
    uiEvents: { source: string; message: Record<string, unknown> }[]
    errors: { source: string; message: Record<string, unknown> }[]
    retryTestConnections: number
  } = {
    lastUiEvent: undefined,
    uiEvents: [],
    errors: [],
    retryTestConnections: 0,
  }

  const server = Bun.serve({
    port,
    routes: {
      // Static routes exclude '/' so WebSocket upgrades reach the fetch handler
      '/health': new Response('OK'),
      '/control-island.html': new Response(HTML_CONTROL_ISLAND, {
        headers: { 'Content-Type': 'text/html' },
      }),
      '/swap-fixture.html': new Response(HTML_SWAP_FIXTURE, {
        headers: { 'Content-Type': 'text/html' },
      }),
      '/module-fixture.html': new Response(HTML_MODULE_FIXTURE, {
        headers: { 'Content-Type': 'text/html' },
      }),
      '/dist/*': async (req) => {
        const path = new URL(req.url).pathname
        const file = Bun.file(join(FIXTURES_DIR, path.replace('/dist/', 'dist/')))
        if (await file.exists()) {
          return new Response(file, {
            headers: { 'Content-Type': 'application/javascript' },
          })
        }
        return new Response('Not Found', { status: 404 })
      },
    },
    websocket: {
      data: {} as { source: string },

      open(ws) {
        const client = ws.data.source
        switch (client) {
          case 'swap-fixture':
            ws.send(DSD_RENDER_MESSAGE)
            break
          case 'module-fixture':
            // Send initial render, then import the module from a site-root path.
            ws.send(MODULE_RENDER_MESSAGE)
            ws.send(
              JSON.stringify({
                type: 'import',
                detail: '/dist/modules/controller-module.js',
              }),
            )
            break
          case 'bad-import-test':
            ws.send(
              JSON.stringify({
                type: 'import',
                detail: '/dist/modules/invalid-controller-module.js',
              }),
            )
            break
          case 'unsupported-event-test':
            ws.send(
              JSON.stringify({
                type: 'unsupported_controller_event',
                detail: { reason: 'fixture' },
              }),
            )
            break
          case 'swap-test':
            sendSwapTestMessages(ws)
            break
          case 'attrs-test':
            sendAttrsTestMessages(ws)
            break
          case 'action-test':
            sendActionTestInitialRender(ws)
            break
          case 'retry-test': {
            state.retryTestConnections++
            if (state.retryTestConnections === 1) {
              // First connection: close with 1012 (Service Restart) to trigger retry
              // 1006 is reserved and cannot be sent in a Close frame per RFC 6455
              setTimeout(() => ws.close(1012, 'test retry'), 100)
            } else {
              // Subsequent connections (after retry): send success render
              ws.send(
                JSON.stringify({
                  type: 'render',
                  detail: {
                    target: 'main',
                    html: '<div id="retry-success">Reconnected!</div>',
                    swap: 'innerHTML',
                  },
                }),
              )
            }
            break
          }
          default:
            ws.send(RENDER_MESSAGE)
        }
      },
      message(ws, message) {
        const data = JSON.parse(String(message))
        if (data.type === 'error') {
          state.errors.push({ source: ws.data.source, message: data })
        }
        if (data.type === 'ui_event') {
          const event = { source: ws.data.source, message: data }
          state.lastUiEvent = event
          state.uiEvents.push(event)
          if (data.detail?.type === 'test_click') {
            ws.send(
              JSON.stringify({
                type: 'render',
                detail: {
                  target: 'main',
                  html: '<div id="action-confirmed">Action received</div>',
                  swap: 'innerHTML',
                },
              }),
            )
          }
        }
      },
      close(_ws) {
        // nothing on close
      },
    },
    fetch(req, server) {
      // Upgrade WebSocket requests on any path (client connects to /ws)
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const source = req.headers.get('sec-websocket-protocol') ?? 'document'
        if (
          server.upgrade(req, {
            data: { source },
            headers: { 'Sec-WebSocket-Protocol': source },
          })
        ) {
          return undefined
        }
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      const pathname = new URL(req.url).pathname

      // Dynamic test pages: /test/<tag>
      if (pathname.startsWith('/test/')) {
        const tag = pathname.replace('/test/', '')
        return new Response(generateTestPage(tag), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Health check at root
      if (pathname === '/') {
        return new Response('OK')
      }
      return new Response('Not Found', { status: 404 })
    },
  })

  return {
    server,
    port: server.port!,
    get lastUiEvent() {
      return state.lastUiEvent
    },
    get uiEvents() {
      return state.uiEvents
    },
    get errors() {
      return state.errors
    },
    stop: async () => {
      server.stop(true)
    },
  }
}

// Allow running as standalone for debugging
if (import.meta.main) {
  const fixture = startServer(3457)
  console.log(`Fixture server listening on http://localhost:${fixture.port}`)
}
