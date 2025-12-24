import { createHostStyles, createStyles } from 'plaited'
import { strokes } from './input-addon.tokens.ts'

export const styles = createStyles({
  addOn: {
    flex: {
      '::slotted(*)': 'none', // Prevent addons from growing
    },
  },
  input: {
    flex: {
      '::slotted([slot=input])': '1', // Input grows to fill space
    },
  },
})

export const hostStyles = createHostStyles({
  display: 'inline-flex',
  '--icon-stroke': {
    $default: strokes.default,
    $compoundSelectors: {
      ':state(focused)': strokes.focused,
      ':state(disabled)': strokes.disabled,
    },
  },
})
