import { Glob } from 'bun'
import type { GlobFilesParams } from '../mcp.schemas.js'

export const globFiles = async ({ cwd, pattern }: GlobFilesParams): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}
