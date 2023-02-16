import { mimeTypes } from './mime-types.ts'
import { compress, serveDir } from './deps.ts'
export const getFileHandler = async ({
  fileExt,
  root,
  pathname,
  req,
}: {
  fileExt: string
  root: string
  pathname: string
  req: Request
}) => {
  const ext: string = fileExt.slice(1)
  if (
    ['js', 'mjs', 'css', 'html', 'htm', 'json', 'xml', 'svg'].includes(ext)
  ) {
    const filePath = `${root}${pathname}`
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
    fsRoot: root,
  })
}
