import { extname, serve, serveTls } from '../deps.ts'
import { CreateServer } from './types.ts'
import { getFileHandler } from './get-file-handler.ts'

export const createServer: CreateServer = ({
  routeHandler,
  credentials,
  port,
  signal,
  onListen,
  root,
}) => {
  const createServer = credentials ? serveTls : serve
  createServer(async (
    req,
    ctx,
  ) => {
    const { pathname } = new URL(req.url)
    const fileExt = extname(pathname)
    if (fileExt) {
      return await getFileHandler({ fileExt, root, pathname, req })
    }
    return await routeHandler(req, ctx)
  }, {
    signal,
    port,
    onListen,
    ...credentials,
  })
}
