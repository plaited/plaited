import { getFileHandler, Routes, server } from '$server'
import { toFileUrl } from '../../libs/deps.ts'
import { setRoutes } from './set-routes.tsx'

const client = `${Deno.cwd()}/tests/client`
const importMap = toFileUrl(`${Deno.cwd()}/.vscode/import-map.json`)

const dev = !Deno.env.has('TEST')
const root = `${Deno.cwd()}/tests/assets`
const routes: Routes = new Map()
const { close, reloadClient, url } = await server({
  reload: dev,
  routes,
  port: 3000,
  root,
  middleware: (handler) => async (req, ctx) => {
    const res = await getFileHandler({ assets: root, req })
    if (res) {
      return res
    }
    return await handler(req, ctx)
  },
})
const getRoutes = () =>
  setRoutes({
    dev,
    routes,
    importMap,
    client,
  })

const log = async () => {
  const res = await fetch(`${url}/tests`, { method: 'GET' })
  const data = await res.json()
  const tests = data.map(({ name, path }: { name: string; path: string }) =>
    `${name}: ${url}${path}`
  )
  console.log(tests)
}

await getRoutes()

await log()

// Watch for changes and reload on client on change
if (dev) {
  const watcher = Deno.watchFs(client, { recursive: true })
  for await (const { kind } of watcher) {
    if (kind === 'modify') {
      const newRoutes = await getRoutes()
      for (const [path, handler] of newRoutes.entries()) {
        routes.set(path, handler)
      }
      reloadClient()
      await log()
    }
  }
}

Deno.addSignalListener('SIGINT', async () => {
  await close()
  Deno.exit()
})
