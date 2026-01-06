import { basename, dirname } from 'node:path'
import { kebabCase } from '../utils.ts'

const getDirPath = (path: string) => {
  const dir = dirname(path)
  return dir === '.' || dir === '/' ? '' : `${dir}`
}

const getStoryPath = ({ entryPath, exportName }: { entryPath: string; exportName: string }) => {
  return `${getDirPath(entryPath)}/${kebabCase(basename(entryPath, '.stories.js'))}--${kebabCase(exportName)}`
}

const getEntryPath = (path: string) => {
  // Remove leading slash if present
  const normalized = path.replace(/^\//, '')
  const fileName = basename(normalized, '.tsx')
  const dirPath = getDirPath(normalized)
  return dirPath ? `/${dirPath}/${fileName}.js` : `/${fileName}.js`
}

export const getPaths = ({ filePath, cwd, exportName }: { filePath: string; cwd: string; exportName: string }) => {
  const relativePath = filePath.startsWith(cwd) ? filePath.slice(cwd.length) : filePath
  const entryPath = getEntryPath(relativePath)
  const route = getStoryPath({ exportName, entryPath })
  return { route, entryPath }
}

/**
 * Generates story URL for browser preview.
 *
 * @param cwd - Current working directory (project root)
 * @param filePath - Absolute path to story file
 * @param exportName - Story export name
 * @param port - Dev server port (defaults to 3000)
 * @returns Story URL string for browser access
 *
 * @public
 */
export const getStoryUrl = ({
  cwd,
  filePath,
  exportName,
  port = 3000,
}: {
  cwd: string
  filePath: string
  exportName: string
  port?: number
}) => {
  const { route } = getPaths({ cwd, filePath, exportName })
  return `http://localhost:${port}${route}`
}
