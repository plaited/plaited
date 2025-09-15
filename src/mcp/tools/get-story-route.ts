import { getStoryId } from './get-story-id.js'
import { getStoryDir } from './get-story-dir.js'
import type { GetStoryRouteParams } from '../mcp.schemas.js'

export const getStoryRoute = ({ filePath, exportName, storyName }: GetStoryRouteParams) => {
  const dir = getStoryDir({ filePath })
  const id = getStoryId({ exportName, storyName })
  return `${dir}/${id}`
}
