import { Watcher } from './types.ts'
import { write } from './write.ts'

export const watcher: Watcher = async ({
  assets,
  colorScheme,
  dev,
  exts,
  importMap,
  port,
  project,
  root,
  updateRoutes,
}) => {
  const watcher = Deno.watchFs(root, { recursive: true })
  let lastEvent = ''
  for await (const { kind } of watcher) {
    if (['any', 'access'].includes(kind)) {
      lastEvent = kind
      continue
    }
    if (kind !== lastEvent) {
      const routes = await write({
        assets,
        colorScheme,
        dev,
        exts,
        importMap,
        port,
        project,
        root,
      })
      updateRoutes(() => routes)
      lastEvent = kind
    }
  }
}
