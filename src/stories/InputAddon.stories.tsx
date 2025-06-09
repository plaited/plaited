import { type StoryObj, STORY_PURPOSE } from 'plaited/workshop'
import { InputAddon } from './InputAddon.js'

export const Example: StoryObj = {
  description: 'Basic example of the InputAddon.',
  template: () => (
    <InputAddon>
      <input slot='input' />
    </InputAddon>
  ),
  parameters: {
    purpose: STORY_PURPOSE.demo,
  },
}
