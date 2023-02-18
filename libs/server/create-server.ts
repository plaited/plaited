import { extname, serve, serveTls } from '../deps.ts'
import { CreateServer, Middleware } from './types.ts'
import { getFileHandler } from './get-file-handler.ts'

const getMiddleware: Middleware = (handler) => async (req, ctx) =>
  await handler(req, ctx)

export const createServer: CreateServer = ({
  routeHandler,
  credentials,
  port,
  signal,
  onListen,
  root,
  middleware = getMiddleware,
}) => {
  const createServer = credentials ? serveTls : serve
  return createServer(
    middleware(async (
      req,
      ctx,
    ) => {
      const { pathname } = new URL(req.url)
      const fileExt = extname(pathname)
      if (fileExt) {
        return await getFileHandler({ fileExt, root, pathname, req })
      }
      return await routeHandler(req, ctx)
    }),
    {
      signal,
      port,
      onListen,
      ...credentials,
    },
  )
}
