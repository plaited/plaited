import { mimeTypes } from './mime-types.js'
import { compress, extname, serveDir } from '../deps.js'
export const getFileHandler = async ({
  assets,
  req,
  exclude = [ 'js', 'map' ],
}: {
  assets: string;
  req: Request;
  exclude?: string[];
}) => {
  const { pathname } = new URL(req.url)
  const fileExt = extname(pathname)
  const ext: string = fileExt.slice(1)
  if (!fileExt || exclude.includes(ext)) return
  if (
    [ 'js', 'mjs', 'css', 'html', 'htm', 'json', 'xml', 'svg' ].includes(ext)
  ) {
    const filePath = `${assets}${pathname}`
    let exist = true
    try {
      await Deno.stat(filePath)
    } catch (_) {
      exist = false
    }
    if (!exist) {
      return new Response(null, {
        status: 404,
      })
    }
    const file = await Deno.readFile(filePath)
    return new Response(compress(file), {
      headers: {
        'content-type': mimeTypes(ext),
        'content-encoding': 'br',
      },
    })
  }
  return serveDir(req, {
    fsRoot: assets,
  })
}
