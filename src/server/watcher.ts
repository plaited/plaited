export const watcher = async (
  reloadClients: Array<(channel: string, data: string) => void>,
  root: string,
) => {
  const watcher = Deno.watchFs(root, { recursive: true })
  let lastEvent = ''
  for await (const { kind } of watcher) {
    if (['any', 'access'].includes(kind)) {
      lastEvent = kind
      continue
    }
    if (kind !== lastEvent) {
      while (reloadClients.length > 0) {
        const cb = reloadClients.pop()
        cb && cb('message', 'reload')
      }
      lastEvent = kind
    }
  }
}
