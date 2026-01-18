import { createTokens } from 'plaited/ui'

export const { surfaces } = createTokens('surfaces', {
  fill: {
    default: { $value: 'lightblue' },
    checked: { $value: 'blue' },
    disabled: { $value: 'gray' },
  },
})
