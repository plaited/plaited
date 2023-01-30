import { fs } from '../deps.ts'
export const getDirs = async  (source: string) => {
  const dirs: string[] = []
  for await (const entry of fs.walk(source, { includeFiles: false})) {
    dirs.push(entry.path)
  }
  return dirs
}
