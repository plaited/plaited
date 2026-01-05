import { createStyles } from 'plaited/ui'

export const badgeStyles = createStyles({
  badge: {
    display: 'inline-block',
    padding: '4px 8px',
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: '1',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  primary: {
    backgroundColor: '#007bff',
    color: 'white',
  },
  success: {
    backgroundColor: '#28a745',
    color: 'white',
  },
  warning: {
    backgroundColor: '#ffc107',
    color: '#212529',
  },
  danger: {
    backgroundColor: '#dc3545',
    color: 'white',
  },
  info: {
    backgroundColor: '#17a2b8',
    color: 'white',
  },
  pill: {
    borderRadius: '50px',
    padding: '4px 12px',
  },
})
