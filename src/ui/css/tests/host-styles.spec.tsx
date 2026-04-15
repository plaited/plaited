import { expect, test } from 'bun:test'
import { createHostStyles } from 'plaited/ui'

test('createHostStyles: supports simple rules', () => {
  const host = createHostStyles({
    fontSize: `16px`,
    lineHeight: 1.5,
    color: 'rgb(60,60,60)',
  })
  expect(host).toMatchSnapshot()
})

test('createHostStyles: supports custom props', () => {
  const host = createHostStyles({
    '--customColor': 'red',
    '--custom-color': 'red',
  })
  expect(host).toMatchSnapshot()
})

test('createHostStyles: supports pseudo-classes', () => {
  const host = createHostStyles({
    backgroundColor: {
      $default: 'lightblue',
      ':hover': 'blue',
      ':active': 'darkblue',
    },
  })
  expect(host).toMatchSnapshot()
})

test('createHostStyles: supports pseudo-elements', () => {
  const host = createHostStyles({
    color: {
      '::placeholder': '#999',
    },
  })
  expect(host).toMatchSnapshot()
})

test('createHostStyles: supports media query', () => {
  const host = createHostStyles({
    width: {
      $default: 800,
      '@media (max-width: 800px)': '100%',
      '@media (min-width: 1540px)': 1366,
    },
  })
  expect(host).toMatchSnapshot()
})

test('createHostStyles: supports complex rules', () => {
  const host = createHostStyles({
    color: {
      $default: 'var(--blue-link)',
      $compoundSelectors: {
        ':hover': {
          '@media (hover: hover)': 'scale(1.1)',
        },
        ':active': 'scale(0.9)',
      },
    },
  })
  expect(host).toMatchSnapshot()
})

test('createHostStyles: works with JSX via spread operator', () => {
  const host = createHostStyles({
    color: {
      $default: 'red',
      '[part="S1"]': 'blue',
      $compoundSelectors: {
        $default: 'var(--blue-link)',
        ':hover': {
          '@media (hover: hover)': 'scale(1.1)',
        },
        ':active': 'scale(0.9)',
      },
    },
  })
  expect(<button {...host}></button>).toMatchSnapshot()
})
