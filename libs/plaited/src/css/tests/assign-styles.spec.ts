import { test, expect } from 'bun:test'
import { assignStyles, createStyles, css } from '../index.js'

test('assignStyles', () => {
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
    large: {
      fontSize: '16px',
      padding: '12px 24px',
    },
  })
  const host = css`
    :host {
      color: red;
    }
  `
  let primary = true
  expect(
    assignStyles(styles.button, styles['small'], primary ? styles.primary : styles.secondary, host),
  ).toMatchSnapshot()
  primary = false
  expect(
    assignStyles(styles.button, styles['large'], primary ? styles.primary : styles.secondary, host),
  ).toMatchSnapshot()
})
