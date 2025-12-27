import { createHostStyles, createStyles, joinStyles } from 'plaited'
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
  strokes.inputAddOn,
  createHostStyles({
    display: 'inline-flex',
  }),
)
