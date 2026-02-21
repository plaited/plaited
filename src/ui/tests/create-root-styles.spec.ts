import { expect, test } from 'bun:test'
import { createRootStyles, createTokens } from 'plaited/ui'

test('createRootStyles: supports simple properties', () => {
  const root = createRootStyles({
    '--primary': '#007bff',
    '--font-size': '16px',
  })
  expect(root.stylesheets).toMatchSnapshot()
})

test('createRootStyles: supports numeric values', () => {
  const root = createRootStyles({
    '--spacing': 8,
  })
  expect(root.stylesheets).toMatchSnapshot()
})

test('createRootStyles: returns only stylesheets (no classNames)', () => {
  const root = createRootStyles({
    '--color': 'red',
  })
  expect(root.stylesheets).toBeDefined()
  expect(Array.isArray(root.stylesheets)).toBe(true)
  expect('classNames' in root).toBe(false)
})

test('createRootStyles: supports nested media queries', () => {
  const root = createRootStyles({
    '--font-size': {
      $default: '16px',
      '@media (min-width: 768px)': '18px',
      '@media (min-width: 1200px)': '20px',
    },
  })
  expect(root.stylesheets).toMatchSnapshot()
})

test('createRootStyles: supports design token references', () => {
  const { colors } = createTokens('colors', {
    primary: { $value: '#007bff' },
  })

  const root = createRootStyles({
    '--brand-color': colors.primary,
  })
  expect(root.stylesheets).toMatchSnapshot()
})

test('createRootStyles: generates :root selector rules', () => {
  const root = createRootStyles({
    '--color': 'blue',
  })
  expect(root.stylesheets.some((s) => s.includes(':root{'))).toBe(true)
})
