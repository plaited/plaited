import { test, expect } from 'bun:test'
import * as css from 'plaited/css'

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

// css.createHost tests
test('createHost: supports simple rules', () => {
  const host = css.createHost({
    fontSize: `16px`,
    lineHeight: 1.5,
    color: 'rgb(60,60,60)',
  })
  expect(host).toMatchSnapshot()
})

test('createHost: supports custom props', () => {
  const host = css.createHost({
    '--customColor': 'red',
    '--custom-color': 'red',
  })
  expect(host).toMatchSnapshot()
})

test('createHost: supports pseudo-classes', () => {
  const host = css.createHost({
    backgroundColor: {
      $default: 'lightblue',
      ':hover': 'blue',
      ':active': 'darkblue',
    },
  })
  expect(host).toMatchSnapshot()
})

test('createHost: supports pseudo-elements', () => {
  const host = css.createHost({
    color: {
      '::placeholder': '#999',
    },
  })
  expect(host).toMatchSnapshot()
})

test('createHost: supports media query', () => {
  const host = css.createHost({
    width: {
      $default: 800,
      '@media (max-width: 800px)': '100%',
      '@media (min-width: 1540px)': 1366,
    },
  })
  expect(host).toMatchSnapshot()
})

test('createHost: supports complex rules', () => {
  const host = css.createHost({
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

test('createHost: works with JSX via spread operator', () => {
  const host = css.createHost({
    color: {
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

// css.createParts tests
test('createParts: supports simple rules', () => {
  const styles = css.createParts({
    button: {
      fontSize: 'var(--fontSize)',
      lineHeight: 'var(--lineHeight)',
      color: 'var(--color)',
    },
  })
  expect(styles).toMatchSnapshot()
})

test('createParts: supports custom props', () => {
  const styles = css.createParts({
    button: {
      '--customColor': 'var(--red)',
      '--custom-color': 'var(--red)',
    },
  })
  expect(styles).toMatchSnapshot()
})

test('createParts: supports pseudo-classes', () => {
  const styles = css.createParts({
    button: {
      backgroundColor: {
        $default: 'var(--lightblue)',
        $compoundSelectors: {
          ':hover': 'var(--blue)',
          ':active': 'var(--darkblue)',
        },
      },
    },
  })
  expect(styles).toMatchSnapshot()
})

test('createParts: works with JSX via spread operator', () => {
  const styles = css.createParts({
    button: {
      backgroundColor: {
        $default: 'var(--lightblue)',
        $compoundSelectors: {
          ':hover': 'var(--blue)',
          ':active': 'var(--darkblue)',
        },
      },
    },
  })
  expect(<button {...styles}></button>).toMatchSnapshot()
})

test('createParts: supports pseudo-elements', () => {
  const styles = css.createParts({
    button: {
      color: {
        '::placeholder': 'var(--placeholder)',
      },
    },
  })
  expect(styles).toMatchSnapshot()
})

test('createParts: supports media query', () => {
  const styles = css.createParts({
    content: {
      width: {
        $default: 'var(--default-width)',
        '@media (max-width: 800px)': 'var(--max-800)',
        '@media (min-width: 1540px)': 'var(--max-1540)',
      },
    },
  })
  expect(styles).toMatchSnapshot()
})

test('createParts: supports complex rules', () => {
  const styles = css.createParts({
    button: {
      color: {
        $default: 'var(--blue-link)',
        $compoundSelectors: {
          ':hover': {
            '@media (hover: hover)': 'var(--hover)',
          },
          ':active': 'var(--active)',
        },
      },
    },
  })
  expect(styles).toMatchSnapshot()
})

test('createParts: supports multiple parts', () => {
  const styles = css.createParts({
    button: {
      fontSize: 'var(--button-fontSize)',
      padding: 'var(--button-padding)',
    },
    label: {
      fontSize: 'var(--label-fontSize)',
      color: 'var(--label-color)',
    },
    icon: {
      width: 'var(--icon-width)',
      height: 'var(--icon-height)',
    },
  })
  expect(styles).toMatchSnapshot()
})

// Additional tests
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
