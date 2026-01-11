import { createHostStyles, createStyles } from 'plaited/ui'

export const styles = createStyles({
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
  button: {
    width: '40px',
    height: '40px',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    fontSize: '20px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s ease',
    backgroundColor: {
      $default: '#007bff',
      ':hover': '#0056b3',
      ':focus': '#0056b3',
      ':active': '#004085',
      '[disabled]': '#6c757d',
    },
    color: 'white',
    outline: {
      $default: 'none',
      ':focus': '2px solid #80bdff',
    },
    outlineOffset: '2px',
  },
  display: {
    minWidth: '48px',
    textAlign: 'center',
    fontSize: '24px',
    fontWeight: '600',
    fontVariantNumeric: 'tabular-nums',
  },
})

export const hostStyles = createHostStyles({
  display: 'inline-block',
})
