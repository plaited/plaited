import { mimeTypes, Routes, server } from '$server'
import { bundler } from '$bundler'
import { html } from '$plaited'

import { ValueDisplayTemplate } from './client/value-display/value-display.template.ts'
import { KeyPadTemplate } from './client/key-pad/key-pad.template.ts'

import { resolve, toFileUrl } from '../deps.ts'

const client = resolve(Deno.cwd(), 'libs/islandly/tests/mocks/client')
const importMap = toFileUrl(resolve(Deno.cwd(), '.vscode/import-map.json'))

const entryPoints = [
  `${client}/key-pad/key-pad.island.ts`,
  `${client}/value-display/value-display.island.ts`,
  `${client}/calculator.spec.ts`,
  `${client}/calculator.worker.ts`,
  `${client}/run.ts`,
]

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

routes.set('/', () =>
  new Response(
    html`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script type="module" src="/key-pad/key-pad.island.js"></script>
  <script type="module" src="/value-display/value-display.island.js"></script>
</head>
<body>
  ${ValueDisplayTemplate}
  ${KeyPadTemplate}
  <script type="module" src="/run.js"></script>
</body>
</html>
`,
    {
      headers: { 'Content-Type': 'text/html' },
    },
  ))

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

await server({
  reload: false,
  routes,
  port: 3000,
})
