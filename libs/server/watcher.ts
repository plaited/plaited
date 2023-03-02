import { wait } from '../utils/mod.ts'

export const watcher = async (
  reloadClients: Set<WebSocket>,
  root: string,
) => {
  const watcher = Deno.watchFs(root, { recursive: true })
  for await (const { kind } of watcher) {
    if (
      kind === 'modify' &&
      reloadClients.size
    ) {
      console.log('send reload')
      reloadClients.forEach((socket) => socket.send(new Date().toString()))
    }
    await wait(100)
  }
}
