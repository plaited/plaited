import { expect, test } from 'bun:test'
import {
  InvalidKeyframeRefPositionError,
  InvalidPropertyNameError,
  InvalidPropertyValueError,
  MissingRegistryError,
  UnresolvedTokenRefError,
} from '../css.errors.ts'
import { createKeyframes, createStyles } from '../css.ts'
import { h } from '../template.ts'

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

test('createStyles: works with h via spread operator', () => {
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
  expect(h('button', { styles: [testStyles.button] })).toMatchSnapshot()
})

test('createStyles: throws InvalidPropertyNameError for unknown property', () => {
  expect(() => {
    createStyles({
      button: { unknownProp: 'red' },
    })
  }).toThrow(InvalidPropertyNameError)
})

test('createStyles: throws InvalidPropertyValueError for invalid enum value', () => {
  expect(() => {
    createStyles({
      button: { 'box-sizing': 'not-a-valid-value' },
    })
  }).toThrow(InvalidPropertyValueError)
})

test('createStyles: accepts valid literal values', () => {
  expect(() => {
    createStyles({
      button: { color: 'red', 'box-sizing': 'border-box' },
    })
  }).not.toThrow()
})

test('createStyles: accepts --* custom properties', () => {
  expect(() => {
    createStyles({
      button: { '--custom-prop': '42px' },
    })
  }).not.toThrow()
})

test('createStyles: validates $host nested values', () => {
  expect(() => {
    createStyles({
      $host: { badProp: 'red' },
    })
  }).toThrow(InvalidPropertyNameError)
})

test('createStyles: resolves $tokenRef from registry and inlines var(--…)', () => {
  const registry = {
    tokens: new Map([
      ['color.primary', { cssVar: 'var(--color-primary)' as const, stylesheets: [':root{--color-primary:blue;}'] }],
    ]),
  }
  const style = createStyles(
    {
      btn: { color: { $tokenRef: 'color.primary' } },
    },
    registry,
  )
  expect(style.btn.classNames).toEqual(['btn', expect.stringMatching(/^cls_/)])
  expect(style.btn.stylesheets).toContain(':root{--color-primary:blue;}')
  expect(style.btn.stylesheets.some((s: string) => s.includes('var(--color-primary)'))).toBe(true)
})

test('createStyles: $tokenRef without registry throws MissingRegistryError', () => {
  expect(() => {
    createStyles({ btn: { color: { $tokenRef: 'color.primary' } } })
  }).toThrow(MissingRegistryError)
})

test('createStyles: missing $tokenRef in registry throws UnresolvedTokenRefError', () => {
  expect(() => {
    createStyles({ btn: { color: { $tokenRef: 'missing.token' } } }, { tokens: new Map() })
  }).toThrow(UnresolvedTokenRefError)
})

test('createStyles: $keyframeRef under color throws InvalidKeyframeRefPositionError', () => {
  expect(() => {
    createStyles({ btn: { color: { $keyframeRef: 'fadeIn' } } }, { keyframes: new Map() })
  }).toThrow(InvalidKeyframeRefPositionError)
})

test('createStyles: $keyframeRef under animation-name resolves to hashed id', () => {
  const registry = {
    keyframes: new Map([['fadeIn', { id: 'fadeIn_cls123', stylesheets: ['@keyframes fadeIn_cls123{}'] }]]),
    tokens: new Map(),
  }
  const style = createStyles(
    {
      anim: { 'animation-name': { $keyframeRef: 'fadeIn' } },
    },
    registry,
  )
  expect(style.anim.classNames).toEqual(['anim', expect.stringMatching(/^cls_/)])
  expect(style.anim.stylesheets.some((s: string) => s.includes('animation-name:fadeIn_cls123'))).toBe(true)
  expect(style.anim.stylesheets).toContain('@keyframes fadeIn_cls123{}')
})

test('createStyles: literal path (no ref) works without registry', () => {
  expect(() => {
    createStyles({ btn: { color: 'red', 'box-sizing': 'border-box' } })
  }).not.toThrow()
})

test('createKeyframes: generates named keyframes with unique id', () => {
  const { pulse } = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.1)' },
    '100%': { transform: 'scale(1)' },
  })
  expect(pulse.id.startsWith('pulse_')).toBeTruthy()
  expect(pulse()).toMatchSnapshot()
})

test('createKeyframes: works with var() values', () => {
  const { spin } = createKeyframes('spin', {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'var(--animations-rotate)' },
  })

  const { pulse } = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'var(--animations-scale)' },
    '100%': { transform: 'scale(1)' },
  })

  expect(spin()).toMatchSnapshot()
  expect(pulse()).toMatchSnapshot()
})
