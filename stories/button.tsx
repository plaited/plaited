import { FT, createStyles, assignStyles } from 'plaited'

const styles = createStyles({
  button: {
    fontFamily: 'Nunito Sans, Helvetica Neue, Helvetica, Arial, sans-serif',
    fontWeight: 700,
    border: 0,
    borderRadius: '3em',
    cursor: 'pointer',
    display: 'inline-block',
    lineHeight: 1,
  },
  primary: {
    color: 'white',
    backgroundColor: '#1ea7fd',
  },
  secondary: {
    color: '#333',
    backgroundColor: 'transparent',
    boxShadow: 'rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset',
  },
  small: {
    fontSize: '12px',
    padding: '10px 16px',
  },
  medium: {
    fontSize: '14px',
    padding: '11px 20px',
  },
  large: {
    fontSize: '16px',
    padding: '12px 24px',
  },
})
export const Button: FT<{
  label?: string
  size?: 'small' | 'medium' | 'large'
  backgroundColor?: string
  primary?: boolean
  value?: string
}> = ({ label, size = 'medium', backgroundColor, primary = false, value, ...rest }) => (
  <button
    {...rest}
    type='button'
    {...assignStyles(styles.button, styles[size], primary ? styles.primary : styles.secondary)}
    value={value}
    style={backgroundColor ? { backgroundColor } : undefined}
  >
    {label}
  </button>
)
