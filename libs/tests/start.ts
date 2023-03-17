import { livereloadTemplate, mimeTypes, Routes, server } from '$server'
import { bundler } from '$bundler'
import { html } from '$plaited'

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
      <script type="module" src="/calculator.island.js"></script>
      <link rel="icon" href="data:," />
    </head>
    <body>
      <div id="root"></div>
      <script type="module" src="/calculator.template.js"></script>
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
  socket.onmessage = (e) => {
    console.log(e.data)
  }
  socket.onerror = (e) => console.log('socket errored:', e)
  socket.onclose = () => {
    console.log('client disconnected')
  }
  return response
})
// Start server
const { reloadClient } = await server({
  reload: true,
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
