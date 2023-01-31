/* eslint-disable no-console */
import { usePort, networkIps, hostnameForDisplay } from './utils.ts'
import { Routes, Server } from './types.ts'
import { watcher } from './watcher.ts'
import { createServer } from './create-server.ts'
import { getHandler } from './get-handler.ts'
import { getOtherHandler } from './get-other-handler.ts'

export const server: Server = async ({
  root,
  routes,
  port:_port = 3000,
  dev = true,
  credentials,
  notFoundTemplate,
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

  const ac = new AbortController() 
  
  const reloadClients:Array<(channel: string, data: string) => void>  = []
  const protocol = credentials ? 'https' : 'http'

  // Get file assets routes
  const otherHandler = getOtherHandler(notFoundTemplate)
  const handler = await getHandler({
    routes,
    reload: dev,
    reloadClients,
    otherHandler,
    errorHandler,
    unknownMethodHandler,
  })
  createServer({
    credentials,
    handler,
    onListen: ({port, hostname,}) => {
      console.log(`Running at ${protocol}://${hostnameForDisplay(hostname)}:${port}`);
    },
    port,
    root,
    signal: ac.signal,
  })

  if(dev) {
    watcher(reloadClients, root)
  }

  // Close socket connections on sigint
  Deno.addSignalListener('SIGINT', () => {
    console.log("Closing server...")
    ac.abort()
    Deno.exit()
  })

  const updateRoutes = async (cb: (oldRoutes: Routes) => Routes) => {
    ac.abort()
    const newRoutes = cb(routes)
    const newHandler = await getHandler({
      routes: newRoutes,
      reload:dev,
      reloadClients,
      otherHandler,
      errorHandler,
      unknownMethodHandler,
    })
    setTimeout(() => {
      createServer({
        credentials,
        handler: newHandler,
        onListen: ({port, hostname,}) => {
          console.log(`Updating routes at ${protocol}://${hostnameForDisplay(hostname)}:${port}`);
        },
        port,
        root,
        signal: ac.signal,
      })
    }, 500)
  }

  return {
    ips: networkIps,
    port,
    protocol,
    root,
    updateRoutes,
    url: `${protocol}://localhost:${port}`,
  }
}
