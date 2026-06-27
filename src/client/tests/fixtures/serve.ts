/**
 * Fixture server for the real-browser controller suite.
 *
 * Serves static HTML pages that load the bundled controller, a WebSocket that
 * drives each test page with scripted server messages, and an HTTP POST
 * endpoint for form submissions. Captures client messages (ui_event, error,
 * success, snapshot) and form POSTs for assertions.
 */
import { join } from 'node:path'
import type { ServerWebSocket } from 'bun'
import { P_FORM_TRIGGER } from '../../../shared/shared.constants.ts'
import { bundleController, CONNECT_PLAITED_ROUTE } from './bundle-controller.ts'

const FIXTURES_DIR = import.meta.dir
const DIST_DIR = join(FIXTURES_DIR, 'dist')
const controllerRoutes = await bundleController()

const connectScript = (modules?: string[]) => {
  const params = new URLSearchParams()
  if (modules?.length) params.set('modules', modules.join(','))
  const qs = params.toString()
  return qs ? `${CONNECT_PLAITED_ROUTE}?${qs}` : CONNECT_PLAITED_ROUTE
}

// Build extension modules served from /dist/modules/.
const moduleResult = await Bun.build({
  entrypoints: [join(FIXTURES_DIR, 'controller-module.ts')],
  outdir: join(DIST_DIR, 'modules'),
  target: 'browser',
  minify: false,
})
if (!moduleResult.success) {
  for (const log of moduleResult.logs) console.error(log)
  throw new Error('Module build failed')
}

// ─── Source identity: page path -> WebSocket source tag ─────────────────────

const PATH_TO_SOURCE: Record<string, string> = {}
const registerSource = (path: string, source: string) => {
  PATH_TO_SOURCE[path] = source
}
const resolveSource = (path: string): string => PATH_TO_SOURCE[path] ?? 'document'

// ─── Server message helpers ──────────────────────────────────────────────────

const renderMsg = (detail: Record<string, unknown>) => ({
  type: 'render',
  detail: { stylesheets: [], swap: 'innerHTML', ...detail },
})
const attrsMsg = (detail: Record<string, unknown>) => ({ type: 'attrs', detail })

// ─── Static HTML fixtures ────────────────────────────────────────────────────

const HTML_CONTROL_ISLAND = `<!DOCTYPE html><html><body>
  <div p-target="main"><p>initial content</p></div>
  <script type="module" src="${connectScript()}"></script>
</body></html>`

const HTML_SWAP_FIXTURE = `<!DOCTYPE html><html><body>
  <div p-target="main"><p>initial swap content</p></div>
  <script type="module" src="${connectScript()}"></script>
</body></html>`

const HTML_VIEW_TRANSITION_FIXTURE = `<!DOCTYPE html><html><head>
  <style>@view-transition{navigation:auto}</style>
</head><body>
  <div p-target="main"><p>vt fixture</p></div>
  <script type="module" src="${connectScript()}"></script>
</body></html>`

const HTML_MODULE_FIXTURE = `<!DOCTYPE html><html><body>
  <div p-target="main">
    <button id="module-p-trigger-btn" data-extra="p-trigger-attr" p-trigger="click:test_click">Standard Trigger</button>
    <button id="module-ext-btn" data-extra="extension-listener" p-trigger="click:module_enhanced_action">Extension</button>
  </div>
  <script type="module" src="${connectScript(['/dist/modules/controller-module.js'])}"></script>
</body></html>`

// ─── Dynamic test pages ──────────────────────────────────────────────────────

const TEST_PAGE_CONTENT: Record<string, string> = {
  'swap-test': `<div p-target="main"><p id="original">original</p></div><div p-target="outer-target">outer original</div>`,
  'attrs-test': `<div p-target="main" data-removable="old-value"><p>attrs target</p></div>`,
  'dispatch-test': `<div p-target="main"><p>dispatch target</p></div>`,
  'styles-test': `<div p-target="main"><p>waiting for styles</p></div>`,
  'action-test': `<div p-target="main"><p>waiting for action</p></div>`,
  'form-test': `<div p-target="main"><p>waiting for form</p></div>`,
  'retry-test': `<div p-target="main"><p>connecting</p></div>`,
  'lifecycle-test': `<div p-target="main"><p>lifecycle</p></div>`,
  'navigate-test': `<div p-target="main"><p>navigate target</p></div>`,
}

// Inline scripts injected before the connect module, keyed by source tag.
// Used to install observers that must be in place before the WebSocket opens.
const TEST_PAGE_SCRIPT: Record<string, string> = {
  'dispatch-test': `<script>
    window.__pingDetail = null
    document.addEventListener('DOMContentLoaded', function () {
      document.querySelector('[p-target="main"]').addEventListener('app:ping', function (e) {
        window.__pingDetail = JSON.stringify(e.detail)
      })
    })
  </script>`,
}

const generateTestPage = (source: string) => {
  const content = TEST_PAGE_CONTENT[source] ?? '<p>test content</p>'
  const inline = TEST_PAGE_SCRIPT[source] ?? ''
  registerSource(`/test/${source}`, source)
  return `<!DOCTYPE html><html><head><title>${source}</title></head><body>
  ${content}
  ${inline}
  <script type="module" src="${connectScript()}"></script>
</body></html>`
}

// ─── Scripted server message sequences ───────────────────────────────────────

const sendSwapMessages = (ws: ServerWebSocket<{ source: string }>) => {
  ws.send(
    JSON.stringify(
      renderMsg({ id: 's1', target: 'main', html: '<p id="inner-result">inner replaced</p>', swap: 'innerHTML' }),
    ),
  )
  ws.send(
    JSON.stringify(
      renderMsg({ id: 's2', target: 'main', html: '<span id="afterbegin-result">first</span>', swap: 'afterbegin' }),
    ),
  )
  ws.send(
    JSON.stringify(
      renderMsg({ id: 's3', target: 'main', html: '<span id="beforeend-result">last</span>', swap: 'beforeend' }),
    ),
  )
  ws.send(
    JSON.stringify(
      renderMsg({ id: 's4', target: 'main', html: '<span id="afterend-result">after main</span>', swap: 'afterend' }),
    ),
  )
  ws.send(
    JSON.stringify(
      renderMsg({
        id: 's5',
        target: 'main',
        html: '<span id="beforebegin-result">before main</span>',
        swap: 'beforebegin',
      }),
    ),
  )
  ws.send(
    JSON.stringify(
      renderMsg({
        id: 's6',
        target: 'outer-target',
        html: '<div id="outer-result" p-target="outer-target">outer replaced</div>',
        swap: 'outerHTML',
      }),
    ),
  )
}

const sendAttrsMessages = (ws: ServerWebSocket<{ source: string }>) => {
  ws.send(JSON.stringify(attrsMsg({ id: 'a1', target: 'main', attr: { class: 'active' } })))
  ws.send(JSON.stringify(attrsMsg({ id: 'a2', target: 'main', attr: { 'data-removable': null } })))
  ws.send(JSON.stringify(attrsMsg({ id: 'a3', target: 'main', attr: { disabled: true } })))
  ws.send(JSON.stringify(attrsMsg({ id: 'a4', target: 'main', attr: { 'data-count': 42 } })))
}

const sendDispatchMessages = (ws: ServerWebSocket<{ source: string }>) => {
  ws.send(
    JSON.stringify({
      type: 'dispatch_custom_event',
      detail: { id: 'd1', target: 'main', event: { type: 'app:ping', detail: { ok: true } } },
    }),
  )
}

const sendStylesMessages = (ws: ServerWebSocket<{ source: string }>) => {
  const primary = '.dynamic-style-target{color:rgb(1, 2, 3);}'
  const secondary = '.dynamic-style-secondary{background-color:rgb(4, 5, 6);}'
  ws.send(
    JSON.stringify(
      renderMsg({
        id: 'st1',
        target: 'main',
        html: '<div id="dynamic-style-target" class="dynamic-style-target">styled</div><div id="dynamic-style-secondary" class="dynamic-style-secondary">secondary</div>',
        stylesheets: [primary, primary, secondary],
      }),
    ),
  )
}

const sendActionInitialRender = (ws: ServerWebSocket<{ source: string }>) => {
  ws.send(
    JSON.stringify(
      renderMsg({
        id: 'ar',
        target: 'main',
        html: '<button id="test-btn" p-trigger="click:test_click">Click me</button>',
      }),
    ),
  )
}

const sendFormInitialRender = (ws: ServerWebSocket<{ source: string }>) => {
  ws.send(
    JSON.stringify(
      renderMsg({
        id: 'fr',
        target: 'main',
        html: '<form id="controller-form" p-form="register" method="post"><input name="name" value="Ada"><input name="tags" value="ui"><input name="tags" value="controller"><button type="submit">Submit</button></form>',
      }),
    ),
  )
}

// ─── Server ──────────────────────────────────────────────────────────────────

export type FixtureServer = {
  server: ReturnType<typeof Bun.serve>
  port: number
  stop: () => Promise<void>
  uiEvents: { source: string; message: Record<string, unknown> }[]
  errors: { source: string; message: Record<string, unknown> }[]
  successes: { source: string; message: Record<string, unknown> }[]
  snapshots: { source: string; message: Record<string, unknown> }[]
  formPosts: { source: string; trigger: string; body: Record<string, unknown> }[]
}

export const startServer = (port = 0): FixtureServer => {
  const state = {
    uiEvents: [] as { source: string; message: Record<string, unknown> }[],
    errors: [] as { source: string; message: Record<string, unknown> }[],
    successes: [] as { source: string; message: Record<string, unknown> }[],
    snapshots: [] as { source: string; message: Record<string, unknown> }[],
    formPosts: [] as { source: string; trigger: string; body: Record<string, unknown> }[],
    retryConnections: 0,
  }

  registerSource('/control-island.html', 'test-island')
  registerSource('/swap-fixture.html', 'swap-fixture')
  registerSource('/view-transition-fixture.html', 'vt-fixture')
  registerSource('/module-fixture.html', 'module-fixture')

  const server = Bun.serve({
    port,
    routes: {
      '/health': new Response('OK'),
      '/control-island.html': new Response(HTML_CONTROL_ISLAND, { headers: { 'Content-Type': 'text/html' } }),
      '/swap-fixture.html': new Response(HTML_SWAP_FIXTURE, { headers: { 'Content-Type': 'text/html' } }),
      '/view-transition-fixture.html': new Response(HTML_VIEW_TRANSITION_FIXTURE, {
        headers: { 'Content-Type': 'text/html' },
      }),
      '/module-fixture.html': new Response(HTML_MODULE_FIXTURE, { headers: { 'Content-Type': 'text/html' } }),
      [CONNECT_PLAITED_ROUTE]: () => controllerRoutes[CONNECT_PLAITED_ROUTE]!.clone(),
      '/dist/*': async (req) => {
        const path = new URL(req.url).pathname
        const file = Bun.file(join(FIXTURES_DIR, path.replace('/dist/', 'dist/')))
        if (await file.exists()) return new Response(file, { headers: { 'Content-Type': 'application/javascript' } })
        return new Response('Not Found', { status: 404 })
      },
    },
    websocket: {
      data: {} as { source: string },
      open(ws) {
        switch (ws.data.source) {
          case 'swap-fixture':
            ws.send(
              JSON.stringify(
                renderMsg({
                  id: 'dsd',
                  target: 'main',
                  html: '<div id="dsd-host"><template shadowrootmode="open"><p>shadow content</p></template></div>',
                }),
              ),
            )
            break
          case 'module-fixture':
            break // buttons are in initial HTML; no render needed
          case 'swap-test':
            sendSwapMessages(ws)
            break
          case 'attrs-test':
            sendAttrsMessages(ws)
            break
          case 'dispatch-test':
            sendDispatchMessages(ws)
            break
          case 'styles-test':
            sendStylesMessages(ws)
            break
          case 'action-test':
            sendActionInitialRender(ws)
            break
          case 'form-test':
            sendFormInitialRender(ws)
            break
          case 'navigate-test':
            ws.send(JSON.stringify({ type: 'navigate', detail: { id: 'n1', url: '/test/swap-test' } }))
            break
          case 'retry-test': {
            state.retryConnections++
            if (state.retryConnections === 1) setTimeout(() => ws.close(1012, 'test retry'), 100)
            else
              ws.send(
                JSON.stringify(
                  renderMsg({ id: 'retry-ok', target: 'main', html: '<div id="retry-success">Reconnected!</div>' }),
                ),
              )
            break
          }
          case 'lifecycle-test':
            // No initial render; the test inspects snapshot/ui_event behavior.
            break
          default:
            ws.send(
              JSON.stringify(
                renderMsg({ id: 'r1', target: 'main', html: '<div id="ws-rendered">Hello from WebSocket</div>' }),
              ),
            )
        }
      },
      message(ws, message) {
        const data = JSON.parse(String(message))
        const entry = { source: ws.data.source, message: data }
        if (data.type === 'error') state.errors.push(entry)
        else if (data.type === 'ui_event') {
          state.uiEvents.push(entry)
          if (data.detail?.event?.type === 'test_click') {
            ws.send(
              JSON.stringify(
                renderMsg({
                  id: 'action-confirmed',
                  target: 'main',
                  html: '<div id="action-confirmed">Action received</div>',
                }),
              ),
            )
          }
        } else if (data.type === 'success') state.successes.push(entry)
        else if (data.type === 'snapshot') state.snapshots.push(entry)
      },
      close() {},
    },
    async fetch(req, server) {
      // Form POST — the controller POSTs to window.location.href with a
      // p-form-trigger header carrying the form's p-form value.
      if (req.method === 'POST') {
        const trigger = req.headers.get(P_FORM_TRIGGER)
        if (trigger) {
          const form = await req.formData()
          const body: Record<string, unknown> = {}
          for (const [key, value] of form.entries()) {
            if (key in body) {
              const existing = body[key]
              body[key] = Array.isArray(existing) ? [...existing, value] : [existing, value]
            } else body[key] = value
          }
          state.formPosts.push({ source: 'form-test', trigger, body })
          return new Response('OK', { status: 200 })
        }
      }

      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const requestUrl = new URL(req.url)
        const source = requestUrl.searchParams.get('source') || resolveSource(requestUrl.pathname) || 'document'
        if (server.upgrade(req, { data: { source } })) return undefined
        return new Response('WebSocket upgrade failed', { status: 400 })
      }

      const pathname = new URL(req.url).pathname
      if (pathname.startsWith('/test/')) {
        const tag = pathname.replace('/test/', '')
        return new Response(generateTestPage(tag), { headers: { 'Content-Type': 'text/html' } })
      }
      if (pathname === '/') return new Response('OK')
      return new Response('Not Found', { status: 404 })
    },
  })

  return {
    server,
    port: server.port!,
    get uiEvents() {
      return state.uiEvents
    },
    get errors() {
      return state.errors
    },
    get successes() {
      return state.successes
    },
    get snapshots() {
      return state.snapshots
    },
    get formPosts() {
      return state.formPosts
    },
    stop: async () => {
      server.stop(true)
    },
  }
}

if (import.meta.main) {
  const fixture = startServer(3457)
  console.log(`Fixture server listening on http://localhost:${fixture.port}`)
}
