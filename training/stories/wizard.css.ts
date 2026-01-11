import { createStyles, createHostStyles } from 'plaited/ui'

export const styles = createStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    fontFamily: 'system-ui, sans-serif',
    maxWidth: '600px',
  },
  nav: {
    display: 'flex',
    gap: '8px',
    paddingBottom: '16px',
    borderBottom: '1px solid #dee2e6',
  },
  navButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    backgroundColor: {
      $default: '#e9ecef',
      ':hover': '#dee2e6',
      '[aria-current="step"]': '#007bff',
    },
    color: {
      $default: '#495057',
      '[aria-current="step"]': 'white',
    },
  },
  content: {
    minHeight: '200px',
    padding: '24px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
  },
  button: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    backgroundColor: {
      $default: '#007bff',
      ':hover': '#0056b3',
      ':focus': '#0056b3',
      '[disabled]': '#6c757d',
    },
    color: 'white',
    outline: {
      $default: 'none',
      ':focus': '2px solid #80bdff',
    },
    outlineOffset: '2px',
  },
  buttonSecondary: {
    backgroundColor: {
      $default: '#6c757d',
      ':hover': '#545b62',
      ':focus': '#545b62',
      '[disabled]': '#adb5bd',
    },
  },
  buttonSuccess: {
    backgroundColor: {
      $default: '#28a745',
      ':hover': '#218838',
      ':focus': '#218838',
      '[disabled]': '#6c757d',
    },
  },
  stepTitle: {
    margin: '0 0 16px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#212529',
  },
})

export const hostStyles = createHostStyles({
  display: 'block',
})
