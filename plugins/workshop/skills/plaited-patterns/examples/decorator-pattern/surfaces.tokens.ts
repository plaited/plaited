import { createTokens } from 'plaited'

export const surfaces = createTokens('surfaces', {
  fill: {
    $default: { $value: 'lightblue' },
    $compoundSelectors: {
      ':state(checked)': { $value: 'blue' },
      ':state(disabled)': { $value: 'gray' },
    },
  },
})
