import { mimeTypes } from './mime-types.ts'
import { HandlerContext } from './types.ts'
import { compress } from '../deps.ts'

const sendAsset = async (filePath:string) => {
  const ext = filePath.substring(filePath.lastIndexOf('.') + 1)
  try {
    const headers = { 'content-type': mimeTypes(ext) }
    let file = await Deno.readFile(filePath)
    if ([ 'js', 'css', 'html', 'json', 'xml', 'svg' ].includes(ext)) {
      file = compress(file)
      Object.assign(headers, { 'content-encoding': 'br' })
    }
    return new Response(file, {
      headers,
    })
  } catch(err) {
    return new Response(null, {
      status: 500,
    })
  }
}

const getFilePaths = async (root: string, paths: string[]) => {
  try {
    const files = await Deno.readDir(root)
    for await (const { isDirectory, isFile, name } of files) {
      const currentRoot = `${root}/${name}`
      isDirectory && await getFilePaths(currentRoot, paths)
      isFile && paths.push(currentRoot)
    }
  }catch(err) {
    console.error(err)
  }
}

export const getFileRoutes = async (root: string) => {
  const paths: string[] = []
  await getFilePaths(root, paths)
  const toRet = {}
  for(const path of paths) {
    Object.assign(toRet, {
      [path.replace(root, '')]: async (req: Request, ctx: HandlerContext) => {
        return await sendAsset(path)
      },
    })
  }
  return toRet
}
