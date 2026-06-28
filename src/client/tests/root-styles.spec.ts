import { expect, test } from 'bun:test'
import { createStyles } from 'plaited/client'

test('$root: supports simple properties', () => {
  const root = createStyles({
    $root: {
      '--primary': '#007bff',
      '--font-size': '16px',
    },
  })
  expect(root.$root.stylesheets).toMatchSnapshot()
})

test('$root: supports numeric values', () => {
  const root = createStyles({
    $root: {
      '--spacing': 8,
    },
  })
  expect(root.$root.stylesheets).toMatchSnapshot()
})

test('$root: returns empty classNames', () => {
  const root = createStyles({
    $root: { '--color': 'red' },
  })
  expect(root.$root.classNames).toEqual([])
  expect(root.$root.stylesheets).toBeDefined()
  expect(Array.isArray(root.$root.stylesheets)).toBe(true)
})

test('$root: supports nested media queries', () => {
  const root = createStyles({
    $root: {
      '--font-size': {
        $default: '16px',
        '@media (min-width: 768px)': '18px',
        '@media (min-width: 1200px)': '20px',
      },
    },
  })
  expect(root.$root.stylesheets).toMatchSnapshot()
})

test('$root: can reference other $root custom properties via var()', () => {
  const root = createStyles({
    $root: {
      '--color-primary': '#007bff',
      '--brand-color': 'var(--color-primary)',
    },
  })
  expect(root.$root.stylesheets).toMatchSnapshot()
})

test('$root: generates :root selector rules', () => {
  const root = createStyles({
    $root: {
      '--color': 'blue',
    },
  })
  expect(root.$root.stylesheets.some((s: string) => s.includes(':root{'))).toBe(true)
})
