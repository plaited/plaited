import path from 'node:path'

export const validateChildPath = (cwd: string, dir?: string) => {
  if (!dir) return cwd
  if (cwd === dir) return cwd
  if (dir.startsWith(cwd + path.sep)) return dir
  throw Error(`Directory "${dir}" must be within the project root`)
}
