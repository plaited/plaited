import { client, getRoutes, routes } from './routes.ts'
import { getFileHandler, server } from '$server'

// Start server
const { reloadClient } = await server({
  reload: Deno.env.has('TEST') ? false : true,
  routes,
  port: 3000,
  middleware: (handler) => async (req, ctx) => {
    const res = await getFileHandler({
      assets: `${Deno.cwd()}/benchmark/assets`,
      req,
    })
    if (res) {
      return res
    }
    return await handler(req, ctx)
  },
})

// Watch for changes and reload on client on change
const watcher = Deno.watchFs(client, { recursive: true })
for await (const { kind } of watcher) {
  if (kind === 'modify') {
    const newRoutes = await getRoutes()
    for (const [path, handler] of newRoutes.entries()) {
      routes.set(path, handler)
    }
    reloadClient()
  }
}
