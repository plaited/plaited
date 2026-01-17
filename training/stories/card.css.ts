import { createStyles } from 'plaited/ui'

export const cardStyles = createStyles({
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBlockEnd: '1px solid #e9ecef',
    fontWeight: '600',
    fontSize: '18px',
  },
  body: {
    padding: '20px',
  },
  footer: {
    padding: '12px 20px',
    borderBlockStart: '1px solid #e9ecef',
    backgroundColor: '#f8f9fa',
  },
  image: {
    inlineSize: '100%',
    blockSize: 'auto',
    display: 'block',
  },
  title: {
    margin: '0',
    marginBlockEnd: '8px',
    fontSize: '20px',
    fontWeight: '600',
    color: '#212529',
  },
  text: {
    margin: '0',
    color: '#6c757d',
    lineHeight: '1.5',
  },
})
