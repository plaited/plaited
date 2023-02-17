import { Watcher } from './types.ts'

export const watcher: Watcher = async ({
  ref,
  startServer,
  root,
}) => {
  const watcher = Deno.watchFs(root, { recursive: true })
  let lastEvent = ''
  for await (const { kind } of watcher) {
    if (['any', 'access'].includes(kind)) {
      lastEvent = kind
      continue
    }
    if (kind !== lastEvent) {
      await ref.close()
      await startServer()
      lastEvent = kind
    }
  }
}
