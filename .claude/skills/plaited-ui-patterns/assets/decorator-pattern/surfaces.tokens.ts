import { createTokens } from 'plaited'

export const { surfaces } = createTokens('surfaces', {
  fill: {
    default: { $value: 'lightblue' },
    checked: { $value: 'blue' },
    disabled: { $value: 'gray' },
  },
})
