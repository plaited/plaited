import { createHostStyles, createStyles, joinStyles } from 'plaited'
import { surfaces } from './surfaces.tokens.ts'

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: {
      $default: surfaces.fill.default,
      ':host(:state(checked))': surfaces.fill.checked,
      ':host(:state(disabled))': surfaces.fill.disabled,
    },
    gridArea: 'input',
  },
})

export const hostStyles = joinStyles(
  surfaces.fill.default,
  surfaces.fill.checked,
  surfaces.fill.disabled,
  createHostStyles({
    display: 'inline-grid',
  }),
)
