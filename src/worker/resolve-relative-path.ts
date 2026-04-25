import { isAbsolute, relative, resolve } from 'node:path'

export const resolveRelativePath = ({ cwd, path }: { cwd: string; path: string }) => {
  if (isAbsolute(path)) {
    throw new Error(`Expected path to be relative to cwd: ${path}`)
  }

  const root = resolve(cwd)
  const target = resolve(root, path)
  const relation = relative(root, target)

  if (relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))) {
    return target
  }

  throw new Error(`Path escapes cwd: ${path}`)
}
