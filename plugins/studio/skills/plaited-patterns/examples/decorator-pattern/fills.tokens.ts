import { createTokens } from 'plaited'

export const fills = createTokens('fills', {
  default: { $value: 'lightblue' },
  checked: { $value: 'blue' },
  disabled: { $value: 'gray' },
})
