import { story } from 'plaited/testing'
import { InputAddon } from './InputAddon.tsx'

export const Example = story({
  description: 'Basic example of the InputAddon.',
  template: () => (
    <InputAddon>
      <input slot='input' />
    </InputAddon>
  ),
})
