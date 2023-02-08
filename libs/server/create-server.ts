import { extname, serve, serveTls } from '../deps.ts'
import { CreateServer } from './types.ts'
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
    req,
    ctx,
  ) => {
    const { pathname } = new URL(req.url)
    const fileExt = extname(pathname)
    return fileExt
      ? await getFileHandler({
        pathname,
        fileExt,
        root,
        req,
      })
      : handler(req, ctx)
  }, {
    signal,
    port,
    onListen,
    ...credentials,
  })
}
