import fs from 'fs/promises'
import {  ServerResponse, IncomingMessage } from 'http'
import path from 'path'
import zlib from 'zlib'
import { getStat } from '@plaited/node-utils'
import { mimeTypes } from './mime-types.js'
import { utf8 } from './utils.js'

const sendError = (ctx: ServerResponse, status: number) => {
  ctx.writeHead(status)
  ctx.write(`${status}`)
  return ctx.end()
}

const sendFile = ({
  ctx,
  status,
  file,
  ext,
}: {
  ctx: ServerResponse,
  status: 200 | 301
  file: string
  ext: string
}) => {
  let encoding: 'binary' | 'utf8' = 'binary'
  let zippedFile: Buffer | string = file
  if ([ 'js', 'css', 'html', 'json', 'xml', 'svg' ].includes(ext)) {
    ctx.setHeader('content-encoding', 'gzip')
    zippedFile = zlib.gzipSync(utf8(file))
    encoding = 'utf8'
  }
  ctx.writeHead(status, { 'content-type': mimeTypes(ext) })
  ctx.write(zippedFile, encoding)
  return  ctx.end()
}

const serverAsset = async (ctx:ServerResponse, filePath:string) => {
  const ext = path.extname(filePath)
  const exist  = await getStat(filePath)
  if(!exist) return sendError(ctx, 404)
  try {
    const file = await fs.readFile(filePath, { encoding: 'binary' })
    return sendFile({
      ctx,
      status: 200,
      file,
      ext,
    })
  } catch(err) {
    return sendError(ctx, 500)
  }
}

const getFilePaths = async (root: string, paths: string[]) => {
  try {
    const files = await fs.readdir(root)
    await Promise.all(files.map(async file => {
      const currentRoot = path.join(root, file)
      const currentExist = await getStat(currentRoot)
      if (currentExist?.isDirectory()) {
        return await getFilePaths(currentRoot, paths)
      } else {
        return paths.push(currentRoot)
      }
    })) 
  }catch(err) {
    console.error(err)
  }
}

export const getFileRoutes = async (root: string) => {
  const paths: string[] = []
  await getFilePaths(root, paths)
  const routes = await Promise.all(paths.map(async filePath => {
    const root = filePath.startsWith(process.cwd()) ? filePath.split(process.cwd())[1] : filePath
    return {
      [root.startsWith('/') ? root : `/${root}`]: async (req: IncomingMessage, ctx: ServerResponse) => {
        return await serverAsset(ctx, filePath)
      },
    }
  }))
  const toRet = {}
  for(const route of routes) {
    Object.assign(toRet, route)
  }
  return toRet
}
