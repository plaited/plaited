import { test, expect } from 'bun:test'
import { css } from 'plaited'

test('css.create: supports simple rules', () => {
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

test('css.create: supports custom props', () => {
  const s = css.create({
    customProps: {
      '--customColor': 'red',
      '--custom-color': 'red',
    },
  })
  expect(s).toMatchSnapshot()
})

test('css.create: supports pseudo-classes', () => {
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

test('css.create: supports pseudo-elements', () => {
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

test('css.create: supports media query', () => {
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

test('css.create: supports combining conditions', () => {
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

test('css.create: works with JSX via spread operator', () => {
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

test('css.join', () => {
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
    small: {
      fontSize: '12px',
      padding: '10px 16px',
    },
  })
  const host = css.host({
    color: 'red',
  })
  expect(css.join(styles.button, styles.small, host)).toMatchSnapshot()
})
