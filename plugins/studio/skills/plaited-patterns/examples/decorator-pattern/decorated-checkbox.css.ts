import { createHostStyles, createStyles } from 'plaited'
import { fills } from './fills.tokens.ts'

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: fills.default,
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

export const hostStyles = createHostStyles({
  display: 'inline-grid',
  gridTemplate: '"input" 16px / 16px',
  backgroundColor: {
    $default: fills.default,
    $compoundSelectors: {
      ':state(checked)': fills.checked,
      ':state(disabled)': fills.disabled,
    },
  },
})
