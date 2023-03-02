/* eslint-disable no-console */
import { hostnameForDisplay, networkIps, usePort } from './utils.ts'
import { Middleware, Server } from './types.ts'
import { watcher } from './watcher.ts'
import { getFileHandler } from './get-file-handler.ts'
import { getRouteHandler } from './get-route-handler.ts'
import { extname, serve, serveTls } from '../deps.ts'

const getMiddleware: Middleware = (handler) => async (req, ctx) =>
  await handler(req, ctx)

export const server: Server = ({
  root,
  routes,
  port: _port = 3000,
  reload = true,
  credentials,
  errorHandler,
  otherHandler,
  unknownMethodHandler,
  middleware = getMiddleware,
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
  const controller = new AbortController()
  const { signal } = controller
  const protocol: 'http' | 'https' = `${credentials ? 'https' : 'http'}`
  const reloadClients = new Set<WebSocket>()

  const createServer = credentials ? serveTls : serve

  const server = createServer(
    middleware(async (
      req,
      ctx,
    ) => {
      const { pathname } = new URL(req.url)
      const fileExt = extname(pathname)
      if (fileExt) {
        return await getFileHandler({ fileExt, root, pathname, req })
      }
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

  if (reload) {
    watcher(reloadClients, root)
  }

  return {
    ips: networkIps,
    port,
    protocol,
    root,
    close: async () => {
      console.log('Closing server...')
      controller.abort()
      await server
    },
    url: `${protocol}://localhost:${port}`,
  }
}
