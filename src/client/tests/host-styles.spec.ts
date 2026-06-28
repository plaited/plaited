import { expect, test } from 'bun:test'
import { createStyles, h } from 'plaited/client'

test('$host: supports simple rules', () => {
  const host = createStyles({
    $host: {
      fontSize: `16px`,
      lineHeight: 1.5,
      color: 'rgb(60,60,60)',
    },
  })
  expect(host.$host).toMatchSnapshot()
})

test('$host: supports custom props', () => {
  const host = createStyles({
    $host: {
      '--customColor': 'red',
      '--custom-color': 'red',
    },
  })
  expect(host.$host).toMatchSnapshot()
})

test('$host: supports pseudo-classes', () => {
  const host = createStyles({
    $host: {
      backgroundColor: {
        $default: 'lightblue',
        ':hover': 'blue',
        ':active': 'darkblue',
      },
    },
  })
  expect(host.$host).toMatchSnapshot()
})

test('$host: supports pseudo-elements', () => {
  const host = createStyles({
    $host: {
      color: {
        '::placeholder': '#999',
      },
    },
  })
  expect(host.$host).toMatchSnapshot()
})

test('$host: supports media query', () => {
  const host = createStyles({
    $host: {
      width: {
        $default: 800,
        '@media (max-width: 800px)': '100%',
        '@media (min-width: 1540px)': 1366,
      },
    },
  })
  expect(host.$host).toMatchSnapshot()
})

test('$host: supports complex rules', () => {
  const host = createStyles({
    $host: {
      color: {
        $default: 'var(--blue-link)',
        $compoundSelectors: {
          ':hover': {
            '@media (hover: hover)': 'scale(1.1)',
          },
          ':active': 'scale(0.9)',
        },
      },
    },
  })
  expect(host.$host).toMatchSnapshot()
})

test('$host: treats compound selector default as host default', () => {
  const host = createStyles({
    $host: {
      color: {
        $compoundSelectors: {
          $default: 'red',
        },
      },
    },
  })

  expect(host.$host.stylesheets).toEqual([':host{color:red;}'])
})

test('$host: works with h via spread operator', () => {
  const host = createStyles({
    $host: {
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
    },
  })
  expect(h('button', host.$host)).toMatchSnapshot()
})

test('$host: returns empty classNames', () => {
  const host = createStyles({
    $host: { color: 'red' },
  })
  expect(host.$host.classNames).toEqual([])
  expect(host.$host.stylesheets).toEqual([':host{color:red;}'])
})
