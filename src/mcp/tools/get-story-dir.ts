import { posix } from 'node:path'
import type { GetStoryDirParams } from '../mcp.schemas.js'

export const getStoryDir = ({ filePath }: GetStoryDirParams) => {
  // Normalize path separators to forward slashes for consistent cross-platform behavior
  let normalizedPath = filePath.replace(/\\/g, '/')

  // Handle Windows absolute paths (C:/path -> /path)
  if (normalizedPath.match(/^[A-Za-z]:/)) {
    normalizedPath = normalizedPath.replace(/^[A-Za-z]:/, '')
  }

  return `${posix.dirname(normalizedPath)}/${posix.basename(normalizedPath, '.tsx')}`
}
