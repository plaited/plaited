import { test, expect } from 'bun:test'
import { css } from '../css.ts'

test('css.create: simple rules', () => {
  const s = css.create({
    base: {
      fontzSize: `16px`,
      lineHeight: 1.5,
      color: 'rgb(60,60,60)',
    },
    highlighted: {
      color: 'rebeccapurple',
    },
  })
  expect(s).toMatchSnapshot()
})

test('css.create: custom props', () => {
  const s = css.create({
    customProps: {
      '--customColor': 'red',
      '--custom-color': 'red',
    },
  })
  expect(s).toMatchSnapshot()
})

test('css.create: Pseudo-classes', () => {
  expect(
    css.create({
      button: {
        backgroundColor: 'lightblue',
      },
    }),
  ).toMatchSnapshot()
  expect(
    css.create({
      button: {
        backgroundColor: {
          default: 'lightblue',
          ':hover': 'blue',
          ':active': 'darkblue',
        },
      },
    }),
  ).toMatchSnapshot()
})

test('css.create: Pseudo-elements', () => {
  expect(
    css.create({
      input: {
        // pseudo-element
        '::placeholder': {
          color: '#999',
        },
        color: {
          default: '#333',
          // pseudo-class
          ':invalid': 'red',
        },
      },
    }),
  ).toMatchSnapshot()
})

test('css.create: media query', () => {
  expect(
    css.create({
      base: {
        width: {
          default: 800,
          '@media (max-width: 800px)': '100%',
          '@media (min-width: 1540px)': 1366,
        },
      },
    }),
  ).toMatchSnapshot()
})

test('css.create: combining conditions', () => {
  expect(
    css.create({
      button: {
        color: {
          default: 'var(--blue-link)',
          ':hover': {
            '@media (hover: hover)': 'scale(1.1)',
          },
          ':active': 'scale(0.9)',
        },
      },
    }),
  ).toMatchSnapshot()
})

test('JSX: spread', () => {
  const s = css.create({
    button: {
      color: {
        default: 'var(--blue-link)',
        ':hover': {
          '@media (hover: hover)': 'scale(1.1)',
        },
        ':active': 'scale(0.9)',
      },
    },
  })
  expect(<button {...s.button}></button>).toMatchSnapshot()
})

test('css.host', () => {
  expect(
    css.host({
      color: {
        default: 'var(--blue-link)',
        '.cloud': 'paleturquoise',
      },
      border: '1px solid black',
    }),
  ).toMatchSnapshot()
})

test('css.keyframes', () => {
  const keyframes = css.keyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.1)' },
    '100%': { transform: 'scale(1)' },
  })
  expect(keyframes.id.startsWith('pulse_')).toBeTruthy()
  expect(keyframes()).toMatchSnapshot()
})

test('css.assign', () => {
  const styles = css.create({
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
  const host = css.host({
    color: 'red',
  })
  let primary = true
  expect(
    css.assign(styles.button, styles['small'], primary ? styles.primary : styles.secondary, host),
  ).toMatchSnapshot()
  primary = false
  expect(
    css.assign(styles.button, styles['large'], primary ? styles.primary : styles.secondary, host),
  ).toMatchSnapshot()
})
