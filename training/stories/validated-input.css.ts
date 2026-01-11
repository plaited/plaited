import { createHostStyles, createStyles } from 'plaited/ui'

export const styles = createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    fontFamily: 'system-ui, sans-serif',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '2px solid #ced4da',
    borderRadius: '4px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    borderColor: {
      $default: '#ced4da',
      ':focus': '#80bdff',
    },
    boxShadow: {
      $default: 'none',
      ':focus': '0 0 0 3px rgba(0, 123, 255, 0.25)',
    },
  },
  error: {
    fontSize: '12px',
    color: '#dc3545',
    minHeight: '18px',
  },
})

export const hostStyles = createHostStyles({
  display: 'block',
  // Custom state styling
  borderColor: {
    ':state(invalid)': '#dc3545',
    ':state(valid)': '#28a745',
  },
})
