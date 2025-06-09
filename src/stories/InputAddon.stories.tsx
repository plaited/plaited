import { type StoryObj, STORY_USAGE } from 'plaited/workshop'
import { InputAddon } from './InputAddon.js'

export const Example: StoryObj = {
  description: 'Basic example of the InputAddon.',
  template: () => (
    <InputAddon>
      <input slot='input' />
    </InputAddon>
  ),
  parameters: {
    usage: STORY_USAGE.doc,
  },
}
