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
  entrypoints: [join(FIXTURES_DIR, 'control-island.entry.ts'), join(FIXTURES_DIR, 'swap-fixture.entry.ts')],
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

// The controlIsland factory applies display:contents via CSS class from createStyles.
// In raw HTML fixtures (not SSR-rendered), we add the style rule directly.
const HTML_CONTROL_ISLAND = `<!DOCTYPE html>
<html>
<head>
  <title>Control Island Test</title>
  <style>test-island { display: contents; }</style>
</head>
<body>
  <test-island p-target="main">
    <p>initial content</p>
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
  <swap-fixture p-target="main">
    <p>initial swap content</p>
  </swap-fixture>
  <script type="module" src="/dist/swap-fixture.entry.js"></script>
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

export type FixtureServer = {
  server: ReturnType<typeof Bun.serve>
  port: number
  stop: () => Promise<void>
}

export const startServer = (port = 0): FixtureServer => {
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
          // Decide which render to send based on the element tag
          if (data.detail === 'swap-fixture') {
            ws.send(DSD_RENDER_MESSAGE)
          } else {
            ws.send(RENDER_MESSAGE)
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
