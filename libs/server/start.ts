/* eslint-disable no-console */
import { hostnameForDisplay, networkIps, usePort } from './utils.ts'
import { Start } from './types.ts'
import { watcher } from './watcher.ts'
import { createServer } from './create-server.ts'
import { getRouteHandler } from './get-route-handler.ts'

import { wait } from '../utils/wait.ts'

export const start: Start = async ({
  root,
  routes,
  port: _port = 3000,
  reload = true,
  credentials,
  errorHandler,
  otherHandler,
  unknownMethodHandler,
}) => {
  // Try start on specified port then fail or find a free port
  const port = usePort(_port) ? _port : usePort()

  // Check if root path exist
  if (!Deno.statSync(root)) {
    console.error(`[ERR] Root directory ${root} does not exist!`)
    Deno.exit()
  }

  // Check if root path is a directory else exit
  if (!Deno.statSync(root).isDirectory) {
    console.error(`[ERR] Root directory "${root}" is not directory!`)
    Deno.exit()
  }

  // Configure globals
  const ac = new AbortController()
  const protocol: 'http' | 'https' = `${credentials ? 'https' : 'http'}`
  const reloadClients: Array<(channel: string, data: string) => void> = []

  const routeHandler = await getRouteHandler({
    routes,
    reload,
    reloadClients,
    otherHandler,
    errorHandler,
    unknownMethodHandler,
  })
  createServer({
    credentials,
    routeHandler,
    onListen: ({ port, hostname }) => {
      console.log(
        `Running at ${protocol}://${hostnameForDisplay(hostname)}:${port}`,
      )
    },
    port,
    root,
    signal: ac.signal,
  })

  if (reload) {
    watcher(reloadClients, root)
  }

  // Close socket connections on sigint
  Deno.addSignalListener('SIGINT', () => {
    console.log('Closing server...')
    ac.abort()
    Deno.exit()
  })

  return {
    ips: networkIps,
    port,
    protocol,
    root,
    close: async () => {
      console.log('Closing server...')
      ac.abort()
      // wait half a second to drop port
      await wait(500)
    },
    url: `${protocol}://localhost:${port}`,
  }
}
