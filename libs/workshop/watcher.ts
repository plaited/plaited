import { Watcher } from './types.ts'

export const watcher: Watcher = async ({
  close: _close,
  getRoutes,
  startServer,
  root,
}) => {
  let close = _close
  const watcher = Deno.watchFs(root, { recursive: true })
  let lastEvent = ''
  for await (const { kind } of watcher) {
    if (['any', 'access'].includes(kind)) {
      lastEvent = kind
      continue
    }
    if (kind !== lastEvent) {
      await close()
      const routes = await getRoutes()
      close = await startServer(routes)
      lastEvent = kind
    }
  }
}
