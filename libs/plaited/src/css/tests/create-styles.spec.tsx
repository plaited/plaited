import { test, expect } from 'bun:test'
import { createStyles } from '../create-styles.js'
import { assignStyles } from '../assign-styles.js'
test('createStyles: simple rules', () => {
  const s = createStyles({
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

test('createStyles: Pseudo-classes', () => {
  expect(
    createStyles({
      button: {
        backgroundColor: 'lightblue',
      },
    }),
  ).toMatchSnapshot()
  expect(
    createStyles({
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

test('createStyles: Pseudo-elements', () => {
  expect(
    createStyles({
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

test('createStyles: media query', () => {
  expect(
    createStyles({
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

test('createStyles: combining conditions', () => {
  expect(
    createStyles({
      button: {
        color: {
          default: 'var(--blue-link)',
          ':hover': {
            default: null,
            '@media (hover: hover)': 'scale(1.1)',
          },
          ':active': 'scale(0.9)',
        },
      },
    }),
  ).toMatchSnapshot()
})

test('JSX: spread', () => {
  const s = createStyles({
    button: {
      color: {
        default: 'var(--blue-link)',
        ':hover': {
          default: null,
          '@media (hover: hover)': 'scale(1.1)',
        },
        ':active': 'scale(0.9)',
      },
    },
  })
  expect(<button {...s.button}></button>).toMatchSnapshot()
})
