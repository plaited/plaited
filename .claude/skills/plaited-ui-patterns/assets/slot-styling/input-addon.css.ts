import { createHostStyles, createStyles, joinStyles } from 'plaited/ui'
import { strokes } from './borders.tokens.ts'

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

export const hostStyles = joinStyles(
  strokes.inputAddOn.default,
  strokes.inputAddOn.focused,
  strokes.inputAddOn.disabled,
  createHostStyles({
    display: 'inline-flex',
    borderColor: {
      $default: strokes.inputAddOn.default,
      ':state(focused)': strokes.inputAddOn.focused,
      ':state(disabled)': strokes.inputAddOn.disabled,
    },
  }),
)
