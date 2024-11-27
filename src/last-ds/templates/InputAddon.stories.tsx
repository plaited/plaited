import { type StoryObj } from 'plaited/test'
import { InputAddon } from './InputAddon.js'

export const Example: StoryObj = {
  template: () => (
    <InputAddon>
      <input slot='input' />
    </InputAddon>
  ),
}
