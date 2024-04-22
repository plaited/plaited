import path from 'node:path'
import { fileExtensions } from './constants.js'

const getPublicRoutes = (routes: [string, string][]): string[] =>
  routes.flatMap(([_, filePath]) => {
    return !filePath.split(path.sep).some((part) => part.startsWith('_')) ? filePath : []
  })

const getRouter = (dir: string) => {
  return new Bun.FileSystemRouter({
    style: 'nextjs',
    dir,
    fileExtensions,
  })
}
