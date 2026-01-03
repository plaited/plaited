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
  input: {
    gridArea: 'input',
    height: '16px',
    width: '16px',
    opacity: '0',
    margin: '0',
    padding: '0',
  },
})

export const hostStyles = joinStyles(
  surfaces.fill.default,
  surfaces.fill.checked,
  surfaces.fill.disabled,
  createHostStyles({
    display: 'inline-grid',
    gridTemplate: '"input" 16px / 16px',
  }),
)
