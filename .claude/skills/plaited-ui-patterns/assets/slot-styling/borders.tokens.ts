import { createTokens } from 'plaited/ui'

export const { strokes } = createTokens('strokes', {
  inputAddOn: {
    default: { $value: 'lightblue' },
    focused: { $value: 'blue' },
    disabled: { $value: 'gray' },
  },
})
