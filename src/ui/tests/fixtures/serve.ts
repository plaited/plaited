/**
 * Fixture server for browser tests.
 * Builds entry files with Bun.build(), serves static HTML/JS,
 * and provides a WebSocket that responds to root_connected with render messages.
 */
import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'

const FIXTURES_DIR = import.meta.dir
const DIST_DIR = join(FIXTURES_DIR, 'dist')

// Build entry files for browser consumption
const buildResult = await Bun.build({
  entrypoints: [
    join(FIXTURES_DIR, 'control-island.entry.ts'),
    join(FIXTURES_DIR, 'swap-fixture.entry.ts'),
    join(FIXTURES_DIR, 'behavioral-fixture.entry.ts'),
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

// Build the behavioral module separately — served at /modules/ for import()
const moduleResult = await Bun.build({
  entrypoints: [join(FIXTURES_DIR, 'behavioral-module.ts')],
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

// The controlIsland factory applies display:contents via CSS class from createStyles.
// In raw HTML fixtures (not SSR-rendered), we add the style rule directly.
// p-target must be on a DESCENDANT of the control island, not the island itself.
// controller() uses root.querySelector('[p-target="..."]') where root = the custom element,
// and querySelector only searches descendants.
const HTML_CONTROL_ISLAND = `<!DOCTYPE html>
<html>
<head>
  <title>Control Island Test</title>
  <style>test-island { display: contents; }</style>
</head>
<body>
  <test-island>
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
  <swap-fixture>
    <div p-target="main"><p>initial swap content</p></div>
  </swap-fixture>
  <script type="module" src="/dist/swap-fixture.entry.js"></script>
</body>
</html>`

const HTML_BEHAVIORAL_FIXTURE = `<!DOCTYPE html>
<html>
<head>
  <title>Behavioral Module Test</title>
  <style>behavioral-fixture { display: contents; }</style>
</head>
<body>
  <behavioral-fixture>
    <div p-target="main"><p>initial behavioral content</p></div>
  </behavioral-fixture>
  <script type="module" src="/dist/behavioral-fixture.entry.js"></script>
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
  <${tag}>
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
    swap: 'innerHTML',
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

const BEHAVIORAL_RENDER_MESSAGE = JSON.stringify({
  type: 'render',
  detail: {
    target: 'main',
    html: '<div id="behavioral-initial">Behavioral fixture loaded</div>',
    swap: 'innerHTML',
  },
})

const BEHAVIORAL_CONFIRMED_MESSAGE = JSON.stringify({
  type: 'render',
  detail: {
    target: 'main',
    html: '<div id="behavioral-confirmed">Module loaded successfully</div>',
    swap: 'innerHTML',
  },
})

// ─── WebSocket message handlers for test elements ─────────────────────────────

const sendSwapTestMessages = (ws: ServerWebSocket<unknown>) => {
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

const sendAttrsTestMessages = (ws: ServerWebSocket<unknown>) => {
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

const sendActionTestInitialRender = (ws: ServerWebSocket<unknown>) => {
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

export type FixtureServer = {
  server: ReturnType<typeof Bun.serve>
  port: number
  stop: () => Promise<void>
  /** Last behavioral_updated message received from the client */
  lastBehavioralUpdated: Record<string, unknown> | undefined
  /** Last user_action message received from the client */
  lastUserAction: Record<string, unknown> | undefined
}

export const startServer = (port = 0): FixtureServer => {
  const state: {
    lastBehavioralUpdated: Record<string, unknown> | undefined
    lastUserAction: Record<string, unknown> | undefined
    retryTestConnections: number
  } = {
    lastBehavioralUpdated: undefined,
    lastUserAction: undefined,
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
      '/behavioral-fixture.html': new Response(HTML_BEHAVIORAL_FIXTURE, {
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
      open(_ws) {
        // nothing on open
      },
      message(ws, message) {
        const data = JSON.parse(String(message))
        if (data.type === 'root_connected') {
          // Decide which render/flow based on the element tag
          switch (data.detail) {
            case 'swap-fixture':
              ws.send(DSD_RENDER_MESSAGE)
              break
            case 'behavioral-fixture':
              // Send initial render, then update_behavioral with the module URL
              ws.send(BEHAVIORAL_RENDER_MESSAGE)
              ws.send(
                JSON.stringify({
                  type: 'update_behavioral',
                  detail: `http://localhost:${server.port}/dist/modules/behavioral-module.js`,
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
        }
        if (data.type === 'behavioral_updated') {
          state.lastBehavioralUpdated = data
          // Confirm with a render so the browser test can verify the roundtrip
          ws.send(BEHAVIORAL_CONFIRMED_MESSAGE)
        }
        if (data.type === 'user_action') {
          state.lastUserAction = data
          if (data.detail === 'test_click') {
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
      // Upgrade WebSocket requests (must be in fetch, not routes,
      // so '/' path WebSocket upgrades are not intercepted by static routes)
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        if (server.upgrade(req)) return undefined
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
    get lastBehavioralUpdated() {
      return state.lastBehavioralUpdated
    },
    get lastUserAction() {
      return state.lastUserAction
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
