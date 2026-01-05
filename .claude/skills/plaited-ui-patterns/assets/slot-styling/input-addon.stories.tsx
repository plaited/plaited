import { story } from 'plaited/testing'
import { InputAddon } from './input-addon.ts'

export const Example = story({
  intent: 'Basic example of the InputAddon.',
  template: () => (
    <InputAddon>
      <input slot='input' />
    </InputAddon>
  ),
})
