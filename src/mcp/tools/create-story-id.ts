import { kebabCase } from '../../utils.js'
import type { CreateStoryIdParams } from '../mcp.schemas.js'

export const createStoryid = ({ exportName, storyName }: CreateStoryIdParams) =>
  `${kebabCase(exportName)}--${kebabCase(storyName)}`
