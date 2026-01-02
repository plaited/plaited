import { createTokens } from 'plaited'

export const { strokes } = createTokens('strokes', {
  inputAddOn: {
    $default: { $value: 'lightblue' },
    $compoundSelectors: {
      ':state(focused)': { $value: 'blue' },
      ':state(disabled)': { $value: 'gray' },
    },
  },
})
