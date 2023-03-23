import { getRoutes, routes, workspace } from './routes.ts'
import { server } from '$server'

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
