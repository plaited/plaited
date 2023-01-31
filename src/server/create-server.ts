import { serve, serveTls, extname, compress, serveDir   } from '../deps.ts'
import { Handler, Credentials, HandlerContext } from './types.ts'
import { mimeTypes } from './mime-types.ts'
export const createServer = ({
  handler,
  credentials,
  port,
  signal,
  onListen,
  root,
}:{
  credentials?: Credentials
  handler: Handler
  port: number
  signal?: AbortSignal
  root: string
  onListen?:((params: {
    hostname: string;
    port: number;
}) => void)
}) => {
  const createServer =  credentials ? serveTls : serve
  createServer(async (
    req: Request,
    ctx: HandlerContext
    ) => {
    const { pathname } = new URL(req.url)
    const fileExt = extname(pathname)
    if(fileExt) {
      const ext:string = fileExt.slice(1)
      if([ 'js', 'mjs', 'css', 'html', 'htm', 'json', 'xml', 'svg' ].includes(ext)) {
        const filePath = `${root}${pathname}`
        let exist = true
        try {
          await Deno.stat(filePath)
        } catch(err) {
          exist = false
        }
        if (!exist) return new Response(null, {
          status: 404,
        })
        const file = await Deno.readFile(filePath)
        return new Response(compress(file), {
          headers: {
            'content-type': mimeTypes(ext),
            'content-encoding': 'br'
          },
        })
      }
      return serveDir(req, {
        fsRoot: root,
      })
    }
    return handler(req, ctx)
  }, {
    signal,
    port,
    onListen,
    ...credentials
  })
}
