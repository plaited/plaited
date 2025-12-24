import { createTokens } from 'plaited'

export const strokes = createTokens('input-addon-stroke', {
  default: { $value: 'lightblue' },
  focused: { $value: 'blue' },
  disabled: { $value: 'gray' },
})
