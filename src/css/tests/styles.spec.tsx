import { expect, test } from 'bun:test'
import { createStyles } from 'plaited/ui'

test('createStyles: supports simple rules', () => {
  const testStyles = createStyles({
    simpleRules: {
      fontSize: `16px`,
      lineHeight: 1.5,
      color: 'rgb(60,60,60)',
    },
  })
  expect(testStyles.simpleRules).toMatchSnapshot()
})

test('createStyles: supports custom props', () => {
  const testStyles = createStyles({
    customProps: {
      '--customColor': 'red',
      '--custom-color': 'red',
    },
  })
  expect(testStyles.customProps).toMatchSnapshot()
})

test('createStyles: supports pseudo-classes', () => {
  const testStyles = createStyles({
    pseudoClass: {
      backgroundColor: {
        $default: 'lightblue',
        ':hover': 'blue',
        ':active': 'darkblue',
      },
    },
  })
  expect(testStyles.pseudoClass).toMatchSnapshot()
})

test('createStyles: supports pseudo-elements', () => {
  const testStyles = createStyles({
    pseudoElement: {
      color: {
        '::placeholder': '#999',
      },
    },
  })
  expect(testStyles.pseudoElement).toMatchSnapshot()
})

test('createStyles: supports media query', () => {
  const testStyles = createStyles({
    mediaQuery: {
      width: {
        $default: 800,
        '@media (max-width: 800px)': '100%',
        '@media (min-width: 1540px)': 1366,
      },
    },
  })
  expect(testStyles.mediaQuery).toMatchSnapshot()
})

test('createStyles: supports complex rules', () => {
  const testStyles = createStyles({
    button: {
      color: {
        $default: 'var(--blue-link)',
        ':hover': {
          '@media (hover: hover)': 'scale(1.1)',
        },
        ':active': 'scale(0.9)',
      },
    },
  })
  expect(testStyles.button).toMatchSnapshot()
})

test('createStyles: works with JSX via spread operator', () => {
  const testStyles = createStyles({
    button: {
      color: {
        $default: 'var(--blue-link)',
        ':hover': {
          '@media (hover: hover)': 'scale(1.1)',
        },
        ':active': 'scale(0.9)',
      },
    },
  })
  expect(<button {...testStyles.button}></button>).toMatchSnapshot()
})
