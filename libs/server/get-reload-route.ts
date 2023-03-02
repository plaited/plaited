import { GetReloadRoute } from './types.ts'

export const getReloadRoute: GetReloadRoute = (
  reloadClient,
) => {
  return [
    '/livereload',
    (req: Request) => {
      const upgrade = req.headers.get('upgrade') || ''
      if (upgrade.toLowerCase() != 'websocket') {
        return new Response('request isn\'t trying to upgrade to websocket.')
      }
      const { socket, response } = Deno.upgradeWebSocket(req)
      socket.onopen = () => {
        console.log('client connected')
        reloadClient.add(socket)
      }
      //@ts-ignore: message exists
      socket.onerror = (e) => console.log('socket errored:', e.message)
      socket.onclose = () => {
        console.log('client disconnected')
        reloadClient.delete(socket)
      }
      return response
    },
  ]
}
