import { createHostStyles, createStyles, joinStyles } from 'plaited'
import { surfaces } from './surfaces.tokens.ts'

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: surfaces.fill,
    gridArea: 'input',
  },
})

export const hostStyles = joinStyles(
  surfaces.fill,
  createHostStyles({
    display: 'inline-grid',
  }),
)
