import {  ServerResponse, IncomingMessage } from 'http'
import { sendMessage  } from './utils.js'
import { Routes } from './types.js'

export const getReloadRoute = (reload: boolean, reloadClients: ServerResponse[]): Record<never, never> | Routes => {
  if(!reload) return {}
  return {
    ['/livereload']: (req: IncomingMessage, ctx: ServerResponse) => {
      ctx.writeHead(200, {
        connection: 'keep-alive',
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
      })
      sendMessage(ctx, 'connected', 'ready')
      setInterval(sendMessage, 60000, ctx, 'ping', 'waiting')
      reloadClients.push(ctx)
    },
  }
}
