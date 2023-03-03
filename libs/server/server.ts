/* eslint-disable no-console */
import { hostnameForDisplay, networkIps, usePort } from './utils.ts'
import { Middleware, Server } from './types.ts'
import { watcher } from './watcher.ts'
import { getRouteHandler } from './get-route-handler.ts'
import { serve, serveTls } from '../deps.ts'

const getMiddleware: Middleware = (handler) => async (req, ctx) =>
  await handler(req, ctx)

export const server: Server = ({
  root,
  routes,
  port: _port = 3000,
  reload,
  credentials,
  errorHandler,
  otherHandler,
  unknownMethodHandler,
  middleware = getMiddleware,
}) => {
  // Try start on specified port then fail or find a free port
  const port = usePort(_port) ? _port : usePort()

  // Configure globals
  const controller = new AbortController()
  const { signal } = controller
  const protocol: 'http' | 'https' = `${credentials ? 'https' : 'http'}`
  const url = `${protocol}://localhost:${port}`
  const reloadClients = new Set<WebSocket>()

  const createServer = credentials ? serveTls : serve

  const server = createServer(
    middleware(async (
      req,
      ctx,
    ) => {
      const routeHandler = await getRouteHandler({
        routes,
        reload,
        reloadClients,
        otherHandler,
        errorHandler,
        unknownMethodHandler,
      })
      return await routeHandler(req, ctx)
    }),
    {
      signal,
      port,
      onListen: ({ port, hostname }) => {
        console.log(
          `Running at ${protocol}://${hostnameForDisplay(hostname)}:${port}`,
        )
      },
      ...credentials,
    },
  )
  const reloadClient = () => {
    if (reloadClients.size) {
      console.log('reloading client')
      reloadClients.forEach((socket) => socket.send(new Date().toString()))
    }
  }

  if (reload && root) { // Check if root path exist
    if (!Deno.statSync(root)) {
      console.error(`[ERR] Root directory ${root} does not exist!`)
      Deno.exit()
    }

    // Check if root path is a directory else exit
    if (!Deno.statSync(root).isDirectory) {
      console.error(`[ERR] Root directory "${root}" is not directory!`)
      Deno.exit()
    }
    watcher(reloadClient, root)
  }

  const close = async () => {
    console.log('Closing server...')
    controller.abort()
    await server
  }

  return {
    ips: networkIps,
    port,
    protocol,
    reloadClient,
    close,
    url,
  }
}
