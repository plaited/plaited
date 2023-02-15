import { extname, serve, serveTls } from '../deps.ts'
import { CreateServer, HandlerContext } from './types.ts'
import { getFileHandler } from './get-file-handler.ts'
export const createServer: CreateServer = ({
  handler,
  credentials,
  port,
  signal,
  onListen,
  root,
}) => {
  const createServer = credentials ? serveTls : serve
  createServer(async (
    req: Request,
    ctx: HandlerContext,
  ) => {
    const { pathname } = new URL(req.url)
    const fileExt = extname(pathname)
    if (fileExt) {
      return await getFileHandler({ fileExt, root, pathname, req })
    }
    return handler(req, ctx)
  }, {
    signal,
    port,
    onListen,
    ...credentials,
  })
}
