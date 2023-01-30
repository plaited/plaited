/* eslint-disable no-console */
// import http2 from 'http2'
import { router } from './router.ts'
import { usePort, networkIps } from './utils.ts'
import { getFileRoutes } from './get-file-routes.ts'
import { getReloadRoute } from './get-reload-route.ts'
import { Routes, Server } from './types.ts'
import { createServer } from '../deps.ts'
export const server: Server = async ({
  root,
  routes,
  port:_port = 3000,
  reload = true,
  credentials,
  otherHandler,
  errorHandler,
  unknownMethodHandler,
}) =>{
  // Try start on specified port then fail or find a free port
  const port = usePort(_port) ? _port : usePort()
  

  // Configure globals
  if (!Deno.statSync(root)) {
    console.error(`[ERR] Root directory ${root} does not exist!`)
    Deno.exit()
  }

  if (!Deno.statSync(root).isDirectory) {
    console.error(`[ERR] Root directory "${root}" is not directory!`)
    Deno.exit()
  }
  
  const reloadClients:Array<(channel: string, data: string) => void>  = []
  const protocol = credentials ? 'https' : 'http'

  // Get file assets routes
  const fileRoutes = await getFileRoutes(root)

  createServer(router(
    {
      ...fileRoutes,
      ...routes,
      ...getReloadRoute(reload, reloadClients),
    },
    otherHandler,
    errorHandler,
    unknownMethodHandler
  ), {
    port,
  })
  
  if(reload) {
    const watcher = Deno.watchFs(root, { recursive: true })
    let lastEvent = ''
    for await (const { kind } of watcher) {
      if([ 'any', 'access' ].includes(kind)) {
        lastEvent = kind
        continue
      }
      if (kind !== lastEvent) {
        while (reloadClients.length > 0) {
          const cb = reloadClients.pop()
          cb && cb('message', 'reload' )
        }
        lastEvent = kind
      }
    }
  }

  // Close socket connections on sigint
  Deno.addSignalListener('SIGINT', () => {
    console.log('interrupted!')
    Deno.exit()
  })
  const addRoutes = (additions: Routes) => {
    Object.assign(routes, additions)
  }

  return {
    ips: networkIps,
    port,
    protocol,
    root,
    addRoutes,
    url: `${protocol}://localhost:${port}`,
  }
}
