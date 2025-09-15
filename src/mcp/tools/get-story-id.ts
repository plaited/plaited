import { kebabCase } from '../../utils.js'
import type { GetStoryIdParams } from '../mcp.schemas.js'

export const getStoryId = ({ exportName, storyName }: GetStoryIdParams) =>
  `${kebabCase(exportName)}--${kebabCase(storyName)}`
