import { basename, dirname } from 'node:path'
import { kebabCase } from '../utils.ts'

const getStoryPath = ({ entryPath, exportName }: { entryPath: string; exportName: string }) => {
  return `${dirname(entryPath)}/${kebabCase(basename(entryPath, '.stories.js'))}--${kebabCase(exportName)}`
}

const getEntryPath = (path: string) => {
  // Remove leading slash if present
  const normalized = path.replace(/^\//, '')
  const dir = dirname(normalized)
  const fileName = basename(normalized, '.tsx')
  // Handle root directory case (dirname returns '.')
  const dirPath = dir === '.' ? '' : `${dir}/`
  return `/${dirPath}${fileName}.js`
}

export const getPaths = ({ filePath, cwd, exportName }: { filePath: string; cwd: string; exportName: string }) => {
  const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length) : filePath
  const entryPath = getEntryPath(relativePath)
  const route = getStoryPath({ exportName, entryPath })
  console.log({ route, entryPath })
  return { route, entryPath }
}
