/**
 * Fixture server for browser tests.
 * Builds entry files with Bun.build(), serves static HTML/JS,
 * and provides a WebSocket that responds to root_connected with render messages.
 */
import { join } from 'node:path'

const FIXTURES_DIR = import.meta.dir
const DIST_DIR = join(FIXTURES_DIR, 'dist')

// Build entry files for browser consumption
const buildResult = await Bun.build({
  entrypoints: [
    join(FIXTURES_DIR, 'control-island.entry.ts'),
    join(FIXTURES_DIR, 'swap-fixture.entry.ts'),
    join(FIXTURES_DIR, 'behavioral-fixture.entry.ts'),
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

export type FixtureServer = {
  server: ReturnType<typeof Bun.serve>
  port: number
  stop: () => Promise<void>
  /** Last behavioral_updated message received from the client */
  lastBehavioralUpdated: Record<string, unknown> | undefined
}

export const startServer = (port = 0): FixtureServer => {
  const state: { lastBehavioralUpdated: Record<string, unknown> | undefined } = {
    lastBehavioralUpdated: undefined,
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
          if (data.detail === 'swap-fixture') {
            ws.send(DSD_RENDER_MESSAGE)
          } else if (data.detail === 'behavioral-fixture') {
            // Send initial render, then update_behavioral with the module URL
            ws.send(BEHAVIORAL_RENDER_MESSAGE)
            ws.send(
              JSON.stringify({
                type: 'update_behavioral',
                detail: `http://localhost:${server.port}/dist/modules/behavioral-module.js`,
              }),
            )
          } else {
            ws.send(RENDER_MESSAGE)
          }
        }
        if (data.type === 'behavioral_updated') {
          state.lastBehavioralUpdated = data
          // Confirm with a render so the browser test can verify the roundtrip
          ws.send(BEHAVIORAL_CONFIRMED_MESSAGE)
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
      // Health check at root
      if (new URL(req.url).pathname === '/') {
        return new Response('OK')
      }
      return new Response('Not Found', { status: 404 })
    },
  })

  return {
    server,
    port: server.port,
    get lastBehavioralUpdated() {
      return state.lastBehavioralUpdated
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
