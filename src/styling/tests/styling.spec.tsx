import { test, expect } from 'bun:test'
import * as css from 'plaited/styling'

test('create: supports simple rules', () => {
  const styles = css.create({
    simpleRules: {
      fontSize: `16px`,
      lineHeight: 1.5,
      color: 'rgb(60,60,60)',
    },
  })
  expect(styles.simpleRules).toMatchSnapshot()
})

test('create: supports custom props', () => {
  const styles = css.create({
    customProps: {
      '--customColor': 'red',
      '--custom-color': 'red',
    },
  })
  expect(styles.customProps).toMatchSnapshot()
})

test('create: supports pseudo-classes', () => {
  const styles = css.create({
    pseudoClass: {
      backgroundColor: {
        $default: 'lightblue',
        ':hover': 'blue',
        ':active': 'darkblue',
      },
    },
  })
  expect(styles.pseudoClass).toMatchSnapshot()
})

test('create: supports pseudo-elements', () => {
  const styles = css.create({
    pseudoElement: {
      color: {
        '::placeholder': '#999',
      },
    },
  })
  expect(styles.pseudoElement).toMatchSnapshot()
})

test('create: supports media query', () => {
  const styles = css.create({
    mediaQuery: {
      width: {
        $default: 800,
        '@media (max-width: 800px)': '100%',
        '@media (min-width: 1540px)': 1366,
      },
    },
  })
  expect(styles.mediaQuery).toMatchSnapshot()
})

test('create: supports complex rules', () => {
  const styles = css.create({
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
  expect(styles.button).toMatchSnapshot()
})

test('create: works with JSX via spread operator', () => {
  const styles = css.create({
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
  expect(<button {...styles.button}></button>).toMatchSnapshot()
})

test('host: simple', () => {
  const host = css.createHost({
    color: 'var(--blue-link)',
    border: '1px solid black',
  })
  expect(host).toMatchSnapshot()
})

test('host: nested host stles', () => {
  const host = css.createHost({
    color: {
      ['@media screen and (width >= 900px)']: 'var(--red-link)',
      $default: 'var(--blue-link)',
      $compoundSelectors: {
        ':state(open)': {
          [`[p-target="part"]`]: 'var(--green-link)',
        },
      },
    },
    border: '1px solid black',
  })
  expect(host).toMatchSnapshot()
})

test('keyframes', () => {
  const keyframes = css.createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.1)' },
    '100%': { transform: 'scale(1)' },
  })
  expect(keyframes.id.startsWith('pulse_')).toBeTruthy()
  expect(keyframes()).toMatchSnapshot()
})

test('join', () => {
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
  const host = css.createHost({
    color: 'red',
  })
  expect(css.join(styles.button, styles.small, host)).toMatchSnapshot()
})

test('createParts', () => {
  const styles = css.createParts({
    part: {
      fontSize: {
        $default: 'var(--variable-2)',
        '@media (min-width: 1540px)': 'var(--variable-1)',
      },
    },
  })
  expect(styles).toMatchSnapshot()
})
