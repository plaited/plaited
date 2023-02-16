import { extname } from '../deps.ts'
import { CreateServer, Middleware } from './types.ts'
import { getFileHandler } from './get-file-handler.ts'

const getMiddleware: Middleware = (handler) => async (req, ctx) =>
  await handler(req, ctx)

export const createServer: CreateServer = async ({
  routeHandler,
  credentials,
  port,
  root,
  middleware = getMiddleware,
  signal,
  protocol,
}) => {
  const createServer = credentials ? Deno.listenTls : Deno.listen
  console.log(
    `server running at: ${protocol}://localhost:${port}/`,
  )

  const server = createServer({
    port,
    ...(credentials ? credentials : {}),
  })

  signal?.addEventListener('abort', () => {
    console.log('Closing server...')
    server.close()
  }, {
    once: true,
  })

  for await (const conn of server) {
    // In order to not be blocking, we need to handle each connection individually
    // without awaiting the function
    serveHttp(conn)
  }

  async function serveHttp(conn: Deno.Conn) {
    // This "upgrades" a network connection into an HTTP connection.
    const httpConn = Deno.serveHttp(conn)
    // Each request sent over the HTTP connection will be yielded as an async
    // iterator from the HTTP connection.
    for await (const requestEvent of httpConn) {
      // The native HTTP server uses the web standard `Request` and `Response`
      // objects.
      // Destructure out the request from the requestEvent
      const { request } = requestEvent
      // create a response callback that applies middleware that can be use for example blocking a request without auth
      const res = middleware(async (
        req,
        ctx,
      ) => {
        // Destructure out the path name from the request url
        const { pathname } = new URL(req.url)
        // Check to see if the request url has a  it has a file extension
        const fileExt = extname(pathname)
        return fileExt
          // If it has a file extension use our file handler
          ? await getFileHandler({ fileExt, root, pathname, req })
          // Else use the route handler
          : await routeHandler(request, ctx)
      })

      // The requestEvent's `.respondWith()` method is how we send the response
      // back to the client.
      requestEvent.respondWith(res(request, conn))
    }
  }
}
