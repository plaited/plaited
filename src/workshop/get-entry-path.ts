import { basename, dirname } from 'node:path'
import { kebabCase } from '../utils.ts'

export const getEntryPath = (path: string, ext: string) => {
  // Remove leading slash if present
  const normalized = path.replace(/^\//, '')
  const dir = dirname(normalized)
  const fileName = kebabCase(basename(normalized, ext))
  // Handle root directory case (dirname returns '.')
  const dirPath = dir === '.' ? '' : `${dir}/`
  return `/${dirPath}${fileName}--index.js`
}
