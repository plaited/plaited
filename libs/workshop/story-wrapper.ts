import { element } from '../island/mod.ts'
import { StoryWrapper } from './types.ts'

export const storyWrapper: StoryWrapper = (tag, template) =>
  element({ tag, template })
