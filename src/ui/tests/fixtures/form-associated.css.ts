import { createHostStyles, createStyles } from 'plaited/ui'

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: 'var(--fill)',
    gridArea: 'input',
  },
})

export const hostStyles = createHostStyles({
  display: 'inline-grid',
  '--fill': {
    $default: 'lightblue',
    $compoundSelectors: {
      ':state(checked)': 'blue',
      ':state(disabled)': 'grey',
    },
  },
})
