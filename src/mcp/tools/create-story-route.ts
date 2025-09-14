import { createStoryid } from './create-story-id.js'
import { createStoryDir } from './create-story-dir.js'
import type { CreateStoryRouteParams } from '../mcp.schemas.js'

export const createStoryRoute = ({ filePath, exportName, storyName }: CreateStoryRouteParams) => {
  const dir = createStoryDir({ filePath })
  const id = createStoryid({ exportName, storyName })
  return `${dir}/${id}`
}
