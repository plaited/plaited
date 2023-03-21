import { livereloadTemplate, mimeTypes, Routes, server } from '$server'
import { bundler } from '$bundler'
import { css, html } from '$plaited'
import { CalculatorTemplate } from './workspace/calculator.template.ts'

import { resolve, toFileUrl, walk } from '../deps.ts'

const __dirname = new URL('.', import.meta.url).pathname
const workspace = resolve(__dirname, 'workspace')
const importMap = toFileUrl(resolve(Deno.cwd(), '.vscode/import-map.json'))

// Get entryPoints for ts files in workspace
const entryPoints: string[] = []
for await (
  const entry of walk(workspace, {
    exts: ['.ts'],
  })
) {
  const { path } = entry
  entryPoints.push(path)
}

// Function to generate routes for entryPoints
const getRoutes = async () => {
  const [entries] = await bundler({
    dev: true,
    entryPoints,
    importMap,
  })

  const routes: Routes = new Map()

  for (const [path, file] of entries) {
    routes.set(
      path,
      () =>
        new Response(file, {
          headers: {
            'content-type': mimeTypes('js'),
          },
        }),
    )
  }
  return routes
}

const routes = await getRoutes()

const { styles, classes } = css`
  body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fixture {
    padding: 12px;
    border: 1px solid black;
  }
`
// Set root route test runner
routes.set('/', () =>
  new Response(
    html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>plaited tests</title>
      <link rel="icon" href="data:," />
      <script type="module" src="/calculator.island.js"></script>
      <style>
        ${styles}
      </style>
    </head>
    <body>
      <details class="${classes.fixture}" id="island-comms-test" open>
        <summary>Island & Comms test</summary>
        ${CalculatorTemplate}
      </details>
      <details class="${classes.fixture}" id="dynamic-island-comms-test" open>
        <summary>Dynamic Island & Comms test</summary>
      </details>
      <details class="${classes.fixture}" id="slot-test" open>
        <summary>Slot test</summary>
      </details>
      <details class="${classes.fixture}" id="template-observer-test" open>
        <summary>Template observer test</summary>
      </details>
      <details class="${classes.fixture}" id="shadow-observer-test" open>
        <summary>Shadow observer test</summary>
      </details>
      <script type="module" src="/test-runner.js"></script>
      ${livereloadTemplate}
    </body>
    </html>
  `,
    {
      headers: { 'Content-Type': 'text/html' },
    },
  ))

// create socket for getting test reports and logging results
routes.set('reporter', (req: Request) => {
  const upgrade = req.headers.get('upgrade') || ''
  if (upgrade.toLowerCase() != 'websocket') {
    return new Response('request isn\'t trying to upgrade to websocket.')
  }
  const { socket, response } = Deno.upgradeWebSocket(req)
  socket.onopen = () => {
    console.log('client connected')
  }
  let end = false
  socket.onmessage = (e) => {
    if (e.data === 'RUN_START') return
    if (e.data === 'RUN_END') {
      end = true
      return
    }
    console.log(e.data)
    if (end && Deno.env.has('TEST')) {
      e.data.includes('0 failed') ? Deno.exit(0) : Deno.exit(1)
    }
  }
  socket.onerror = (e) => console.log('socket errored:', e)
  socket.onclose = () => {
    console.log('client disconnected')
  }
  return response
})
// Start server
const { reloadClient } = await server({
  reload: Deno.env.has('TEST') ? false : true,
  routes,
  port: 3000,
})

// Watch for changes and reload on client on change
const watcher = Deno.watchFs(workspace, { recursive: true })
for await (const { kind } of watcher) {
  if (kind === 'modify') {
    const newRoutes = await getRoutes()
    for (const [path, handler] of newRoutes.entries()) {
      routes.set(path, handler)
    }
    reloadClient()
  }
}
