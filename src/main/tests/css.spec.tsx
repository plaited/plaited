import { test, expect } from 'bun:test'
import { css } from 'plaited'

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

// css.host tests
test('host: supports simple rules', () => {
  const host = css.host({
    fontSize: `16px`,
    lineHeight: 1.5,
    color: 'rgb(60,60,60)',
  })
  expect(host).toMatchSnapshot()
})

test('host: supports custom props', () => {
  const host = css.host({
    '--customColor': 'red',
    '--custom-color': 'red',
  })
  expect(host).toMatchSnapshot()
})

test('host: supports pseudo-classes', () => {
  const host = css.host({
    backgroundColor: {
      $default: 'lightblue',
      ':hover': 'blue',
      ':active': 'darkblue',
    },
  })
  expect(host).toMatchSnapshot()
})

test('host: supports pseudo-elements', () => {
  const host = css.host({
    color: {
      '::placeholder': '#999',
    },
  })
  expect(host).toMatchSnapshot()
})

test('host: supports media query', () => {
  const host = css.host({
    width: {
      $default: 800,
      '@media (max-width: 800px)': '100%',
      '@media (min-width: 1540px)': 1366,
    },
  })
  expect(host).toMatchSnapshot()
})

test('host: supports complex rules', () => {
  const host = css.host({
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

test('host: works with JSX via spread operator', () => {
  const host = css.host({
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

// Additional tests
test('keyframes', () => {
  const keyframes = css.keyframes('pulse', {
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
  const host = css.host({
    color: 'red',
  })
  expect(css.join(styles.button, styles.small, host)).toMatchSnapshot()
})
