/**
 * Fixture server for browser tests.
 * Builds entry files with Bun.build(), serves static HTML/JS,
 * and provides a WebSocket that responds to controller connections.
 *
 * Source identification: the server maps page request paths to WebSocket
 * source identities. When a page is served with a known controller tag,
 * the WebSocket connection on that page's URL is associated with that tag.
 */
import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'
import { bundleController, CONNECT_ONBRAID_ROUTE } from './bundle-controller.ts'

const FIXTURES_DIR = import.meta.dir
const DIST_DIR = join(FIXTURES_DIR, 'dist')
const controllerRoutes = await bundleController()

const connectScript = (modules?: string[], agentCardId?: string) => {
  let url = CONNECT_ONBRAID_ROUTE
  const params = new URLSearchParams()
  if (modules?.length) {
    params.set('modules', modules.join(','))
  }
  if (agentCardId) {
    params.set('agentCardId', agentCardId)
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
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

// ─── Source identity mapping ──────────────────────────────────────────────────
// Maps page request paths to WebSocket source tags.
const PATH_TO_SOURCE: Record<string, string> = {}

const registerSource = (path: string, source: string) => {
  PATH_TO_SOURCE[path] = source
}

const resolveSource = (path: string): string => {
  return PATH_TO_SOURCE[path] ?? 'document'
}

// ─── Static HTML fixtures ─────────────────────────────────────────────────────

const HTML_CONTROL_ISLAND = `<!DOCTYPE html>
<html>
<head>
  <title>Control Island Test</title>
</head>
<body>
  <div o-target="main"><p>initial content</p></div>
  <script type="module" src="${connectScript()}"></script>
</body>
</html>`

const HTML_SWAP_FIXTURE = `<!DOCTYPE html>
<html>
<head>
  <title>Swap Fixture Test</title>
</head>
<body>
  <div o-target="main"><p>initial swap content</p></div>
  <script type="module" src="${connectScript()}"></script>
</body>
</html>`

const HTML_MODULE_FIXTURE = `<!DOCTYPE html>
<html>
<head>
  <title>Controller Module Test</title>
</head>
<body>
  <div o-target="main">
    <button id="module-o-trigger-btn" data-extra="o-trigger-attr" o-trigger="click:test_click">O-trigger Action</button>
    <button id="module-enhanced-btn" data-extra="module-listener">Module Listener</button>
    <div id="module-initial">Module fixture loaded</div>
  </div>
  <script type="module" src="${connectScript(['/dist/modules/controller-module.js'])}"></script>
</body>
</html>`

// ─── Dynamic test page HTML ───────────────────────────────────────────────────

const TEST_PAGE_CONTENT: Record<string, string> = {
  'swap-test': `
    <div o-target="main"><p id="original">original</p></div>
    <div o-target="outer-target">outer original</div>
  `,
  'attrs-test': `
    <div o-target="main" data-removable="old-value"><p>attrs target</p></div>
  `,
  'action-test': `
    <div o-target="main"><p>waiting for action</p></div>
  `,
  'form-submit-test': `
    <div o-target="main"><p>waiting for form submit</p></div>
  `,
  'retry-test': `
    <div o-target="main"><p>connecting</p></div>
  `,
  'styles-test': `
    <div o-target="main"><p>waiting for styles</p></div>
  `,
  'style-error-test': `
    <div o-target="main"><p>waiting for style error</p></div>
  `,
  'bad-import-test': `
    <div o-target="main"><p>waiting for bad import</p></div>
  `,
  'unsupported-event-test': `
    <div o-target="main"><p>waiting for unsupported event</p></div>
  `,
  'a2a-test': `
    <div o-target="main"><p>a2a test</p></div>
  `,
}

const generateTestPage = (source: string) => {
  const content = TEST_PAGE_CONTENT[source] ?? '<p>test content</p>'
  const testPath = `/test/${source}`
  registerSource(testPath, source)
  const styleErrorPatch =
    source === 'style-error-test'
      ? `<script>
  const originalReplace = CSSStyleSheet.prototype.replace
  CSSStyleSheet.prototype.replace = function(styles) {
    if (styles.includes('fixture-invalid-stylesheet')) {
      return Promise.reject(new Error('fixture stylesheet rejection'))
    }
    return originalReplace.call(this, styles)
  }
  </script>`
      : ''
  const moduleScript =
    source === 'bad-import-test'
      ? ` type="module" src="${connectScript(['/dist/modules/invalid-controller-module.js'])}"`
      : source === 'a2a-test'
        ? ` type="module" src="${connectScript(undefined, 'agent-card')}"`
        : ` type="module" src="${connectScript()}"`

  const agentCardTag =
    source === 'a2a-test'
      ? `<script id="agent-card" type="application/agent+json">
{
  "name": "A2A Test Agent",
  "description": "A test agent for webA2A protocol",
  "version": "1.0.0",
  "skills": [
    {
      "id": "search",
      "name": "Search",
      "description": "Search the web for a query"
    }
  ]
}
</script>`
      : ''

  return `<!DOCTYPE html>
<html>
<head>
  <title>${source} Test</title>
</head>
<body>
  ${agentCardTag}
  ${content}
  ${styleErrorPatch}
  <script${moduleScript}></script>
</body>
</html>`
}

// ─── Server message helpers ───────────────────────────────────────────────────

/** Send a JSON message to a connected controller island. */
const send = (ws: ServerWebSocket<{ source: string }>, message: Record<string, unknown>) => {
  ws.send(JSON.stringify(message))
}

// ─── Server message templates ─────────────────────────────────────────────────

const RENDER_MESSAGE = {
  type: 'render',
  detail: {
    id: 'render-1',
    target: 'main',
    html: '<div id="ws-rendered">Hello from WebSocket</div>',
    stylesheets: [],
    swap: 'innerHTML',
    registry: [],
  },
}

const DSD_RENDER_MESSAGE = {
  type: 'render',
  detail: {
    id: 'render-dsd',
    target: 'main',
    html: '<div id="dsd-host"><template shadowrootmode="open"><style>:host { display: block; }</style><p>shadow content</p></template></div>',
    stylesheets: [],
    swap: 'innerHTML',
    registry: [],
  },
}

// ─── WebSocket message handlers for test elements ─────────────────────────────

const sendSwapTestMessages = (ws: ServerWebSocket<{ source: string }>) => {
  // Step 1: innerHTML — replace children of 'main'
  send(ws, {
    type: 'render',
    detail: {
      id: 'swap-1',
      target: 'main',
      html: '<p id="inner-result">inner replaced</p>',
      stylesheets: [],
      swap: 'innerHTML',
      registry: [],
    },
  })
  // Step 2: afterbegin — prepend inside 'main'
  send(ws, {
    type: 'render',
    detail: {
      id: 'swap-2',
      target: 'main',
      html: '<span id="afterbegin-result">first</span>',
      stylesheets: [],
      swap: 'afterbegin',
      registry: [],
    },
  })
  // Step 3: beforeend — append inside 'main'
  send(ws, {
    type: 'render',
    detail: {
      id: 'swap-3',
      target: 'main',
      html: '<span id="beforeend-result">last</span>',
      stylesheets: [],
      swap: 'beforeend',
      registry: [],
    },
  })
  // Step 4: afterend — insert after 'main' element
  send(ws, {
    type: 'render',
    detail: {
      id: 'swap-4',
      target: 'main',
      html: '<span id="afterend-result">after main</span>',
      stylesheets: [],
      swap: 'afterend',
      registry: [],
    },
  })
  // Step 5: beforebegin — insert before 'main' element
  send(ws, {
    type: 'render',
    detail: {
      id: 'swap-5',
      target: 'main',
      html: '<span id="beforebegin-result">before main</span>',
      stylesheets: [],
      swap: 'beforebegin',
      registry: [],
    },
  })
  // Step 6: outerHTML — replace 'outer-target' element itself
  send(ws, {
    type: 'render',
    detail: {
      id: 'swap-6',
      target: 'outer-target',
      html: '<div id="outer-result" o-target="outer-target">outer replaced</div>',
      stylesheets: [],
      swap: 'outerHTML',
      registry: [],
    },
  })
}

const sendAttrsTestMessages = (ws: ServerWebSocket<{ source: string }>) => {
  send(ws, { type: 'attrs', detail: { id: 'attrs-1', target: 'main', attr: { class: 'active' } } })
  send(ws, { type: 'attrs', detail: { id: 'attrs-2', target: 'main', attr: { 'data-removable': null } } })
  send(ws, { type: 'attrs', detail: { id: 'attrs-3', target: 'main', attr: { disabled: true } } })
  send(ws, { type: 'attrs', detail: { id: 'attrs-4', target: 'main', attr: { 'data-count': 42 } } })
}

const sendActionTestInitialRender = (ws: ServerWebSocket<{ source: string }>) => {
  send(ws, {
    type: 'render',
    detail: {
      id: 'action-render',
      target: 'main',
      html: '<button id="test-btn" o-trigger="click:test_click">Click me</button>',
      stylesheets: [],
      swap: 'innerHTML',
      registry: [],
    },
  })
}

const sendFormSubmitInitialRender = (ws: ServerWebSocket<{ source: string }>) => {
  send(ws, {
    type: 'render',
    detail: {
      id: 'form-render',
      target: 'main',
      html: '<form id="controller-form" action="/submit-form" method="post"><input name="name" value="Ada"><input name="tags" value="ui"><input name="tags" value="controller"><button id="controller-form-submit" type="submit">Submit</button></form>',
      stylesheets: [],
      swap: 'innerHTML',
      registry: [],
    },
  })
}

const sendStylesTestMessages = (ws: ServerWebSocket<{ source: string }>) => {
  const primary = '.dynamic-style-target{color:rgb(1, 2, 3);}'
  const secondary = '.dynamic-style-secondary{background-color:rgb(4, 5, 6);}'
  send(ws, {
    type: 'render',
    detail: {
      id: 'styles-1',
      target: 'main',
      html: '<div id="dynamic-style-target" class="dynamic-style-target">styled</div><div id="dynamic-style-secondary" class="dynamic-style-secondary">styled secondary</div>',
      stylesheets: [primary, primary, secondary],
      swap: 'innerHTML',
      registry: [],
    },
  })
  send(ws, {
    type: 'render',
    detail: {
      id: 'styles-2',
      target: 'main',
      html: '<div id="dynamic-style-target" class="dynamic-style-target">styled again</div><div id="dynamic-style-secondary" class="dynamic-style-secondary">styled secondary again</div>',
      stylesheets: [primary],
      swap: 'innerHTML',
      registry: [],
    },
  })
}

const sendStyleErrorTestMessage = (ws: ServerWebSocket<{ source: string }>) => {
  send(ws, {
    type: 'render',
    detail: {
      id: 'style-error',
      target: 'main',
      html: '<div id="style-error-target" class="style-error-target">style error target</div>',
      stylesheets: ['.fixture-invalid-stylesheet{}', '.style-error-target{color:rgb(7, 8, 9);}'],
      swap: 'innerHTML',
      registry: [],
    },
  })
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
  /** Form submit messages received from controller islands. */
  formSubmissions: { source: string; message: Record<string, unknown> }[]
  /** Controller runtime errors received from controller islands. */
  errors: { source: string; message: Record<string, unknown> }[]
  /** A2A task messages received from controller islands. */
  a2aTasks: { source: string; message: Record<string, unknown> }[]
  /** Find an A2A task by source. */
  findA2ATask: (opts: {
    after: number
    source: string
  }) => { source: string; message: Record<string, unknown> } | undefined
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
    formSubmissions: { source: string; message: Record<string, unknown> }[]
    errors: { source: string; message: Record<string, unknown> }[]
    a2aTasks: { source: string; message: Record<string, unknown> }[]
    retryTestConnections: number
  } = {
    lastUiEvent: undefined,
    uiEvents: [],
    formSubmissions: [],
    errors: [],
    a2aTasks: [],
    retryTestConnections: 0,
  }

  // Register static fixture paths
  registerSource('/control-island.html', 'test-island')
  registerSource('/swap-fixture.html', 'swap-fixture')
  registerSource('/module-fixture.html', 'module-fixture')

  const server = Bun.serve({
    port,
    routes: {
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
      [CONNECT_ONBRAID_ROUTE]: () => controllerRoutes[CONNECT_ONBRAID_ROUTE]!.clone(),
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
            send(ws, DSD_RENDER_MESSAGE)
            break
          case 'module-fixture':
            // The module Register function is loaded via connect.js modules param
            // and runs during initialization. No render message needed —
            // buttons are in the initial HTML.
            break
          case 'bad-import-test':
            // The invalid module is loaded as a Register function via connect.js modules param.
            // It exports a non-function default, so it will fail when the controller tries to
            // invoke it as a Register. The error is caught and reported.
            send(ws, {
              type: 'render',
              detail: {
                id: 'bad-import-render',
                target: 'main',
                html: '<p>bad import test</p>',
                stylesheets: [],
                swap: 'innerHTML',
                registry: [],
              },
            })
            break
          case 'unsupported-event-test':
            send(ws, {
              type: 'render',
              detail: {
                id: 'unsupported-render',
                target: 'main',
                html: '<p>unsupported event test</p>',
                stylesheets: [],
                swap: 'innerHTML',
                registry: [],
              },
            })
            send(ws, {
              type: 'unsupported_controller_event',
              detail: { id: 'unsupported', reason: 'fixture' },
            })
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
          case 'form-submit-test':
            sendFormSubmitInitialRender(ws)
            break
          case 'retry-test': {
            state.retryTestConnections++
            if (state.retryTestConnections === 1) {
              // First connection: close with 1012 (Service Restart) to trigger retry
              setTimeout(() => ws.close(1012, 'test retry'), 100)
            } else {
              // Subsequent connections (after retry): send success render
              send(ws, {
                type: 'render',
                detail: {
                  id: 'retry-success',
                  target: 'main',
                  html: '<div id="retry-success">Reconnected!</div>',
                  stylesheets: [],
                  swap: 'innerHTML',
                  registry: [],
                },
              })
            }
            break
          }
          case 'styles-test':
            sendStylesTestMessages(ws)
            break
          case 'style-error-test':
            sendStyleErrorTestMessage(ws)
            break
          default:
            send(ws, RENDER_MESSAGE)
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
          if (data.detail?.event?.type === 'test_click') {
            send(ws, {
              type: 'render',
              detail: {
                id: 'action-confirmed',
                target: 'main',
                html: '<div id="action-confirmed">Action received</div>',
                stylesheets: [],
                swap: 'innerHTML',
                registry: [],
              },
            })
          }
        }
        if (data.type === 'form_submit') {
          state.formSubmissions.push({ source: ws.data.source, message: data })
        }
        if (data.type === 'a2a_task') {
          state.a2aTasks.push({ source: ws.data.source, message: data })
          // Auto-reply with completed result after a brief delay
          const taskId = (data.detail as Record<string, unknown>)?.taskId as string
          setTimeout(() => {
            send(ws, {
              type: 'a2a_result',
              detail: {
                taskId,
                state: 'completed',
                parts: [{ data: { result: 'ok' } }],
              },
            })
          }, 500)
        }
      },
      close(_ws) {
        // nothing on close
      },
    },
    fetch(req, server) {
      // Upgrade WebSocket requests on any path.
      // Source identity is resolved from the request URL path.
      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const requestUrl = new URL(req.url)
        const source = requestUrl.searchParams.get('source') || resolveSource(requestUrl.pathname) || 'document'
        if (
          server.upgrade(req, {
            data: { source },
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
    get formSubmissions() {
      return state.formSubmissions
    },
    get errors() {
      return state.errors
    },
    get a2aTasks() {
      return state.a2aTasks
    },
    findA2ATask: ({ after, source }) => state.a2aTasks.slice(after).find((t) => t.source === source),
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
