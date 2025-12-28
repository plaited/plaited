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
 * @returns Object containing interactive story URL and template-only URL
 *
 * @remarks
 * Returns two URLs:
 * - `url`: Full interactive story with play functions and UI
 * - `templateUrl`: Template-only render for visual inspection
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
  return {
    url: `http://localhost:${port}${route}`,
    templateUrl: `http://localhost:${port}${route}.template`,
  }
}

/**
 * Custom tool for Claude Agent SDK to generate story preview URLs.
 *
 * @remarks
 * This tool enables AI agents to generate URLs for viewing stories in the browser,
 * returning both the interactive story URL and template-only URL for visual inspection.
 *
 * The dev server must be running for these URLs to be accessible.
 *
 * @see {@link getStoryUrl} for the underlying implementation
 *
 * @public
 */
export const getStoryUrlTool = {
  name: 'get_story_url',
  description: 'Get URL to render a story in the browser. Returns both interactive story URL and template-only URL.',
  parameters: {
    type: 'object',
    properties: {
      cwd: { type: 'string', description: 'Current working directory (project root)' },
      filePath: { type: 'string', description: 'Absolute path to story file' },
      exportName: { type: 'string', description: 'Story export name' },
      port: { type: 'number', description: 'Dev server port (default: 3000)' },
    },
    required: ['cwd', 'filePath', 'exportName'],
  },
  execute: async (params: { cwd: string; filePath: string; exportName: string; port?: number }) => {
    return getStoryUrl(params)
  },
}
