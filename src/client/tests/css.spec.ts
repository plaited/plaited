import { expect, test } from 'bun:test'
import { createKeyframes, createStyles, InvalidPropertyNameError, InvalidPropertyValueError } from '../css.ts'
import { h } from '../template.ts'

test('createStyles: supports simple rules', () => {
  const testStyles = createStyles({
    simpleRules: {
      'font-size': `16px`,
      'line-height': 1.5,
      color: 'rgb(60,60,60)',
    },
  })
  expect(testStyles.simpleRules).toMatchSnapshot()
})

test('createStyles: supports custom props', () => {
  const testStyles = createStyles({
    customProps: {
      '--custom-prop-name': 'red',
      '--custom-color': 'red',
    },
  })
  expect(testStyles.customProps).toMatchSnapshot()
})

test('createStyles: supports pseudo-classes', () => {
  const testStyles = createStyles({
    pseudoClass: {
      'background-color': {
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

test('createStyles: empty class object produces empty result', () => {
  const result = createStyles({})
  expect(result).toEqual({})
})

test('createStyles: zero and empty string are valid values', () => {
  const result = createStyles({
    box: {
      width: 0,
      opacity: 0.5,
      margin: '',
    },
  })
  expect(result.box.classNames.length).toBeGreaterThanOrEqual(1)
  expect(result.box.stylesheets.length).toBeGreaterThanOrEqual(1)
})

test('createStyles: deterministic output — same input produces same hash', () => {
  const a = createStyles({ btn: { color: 'red' } })
  const b = createStyles({ btn: { color: 'red' } })
  expect(a.btn.classNames).toEqual(b.btn.classNames)
  expect(a.btn.stylesheets).toEqual(b.btn.stylesheets)
})

test('createStyles: $root with custom properties', () => {
  const result = createStyles({
    $root: {
      '--primary': 'blue',
      '--secondary': 'gray',
    },
  })
  expect(result.$root.classNames).toEqual([])
  expect(result.$root.stylesheets.length).toBeGreaterThanOrEqual(1)
  expect(result.$root.stylesheets.some((s) => s.startsWith(':root'))).toBe(true)
})

test('createStyles: $root with pseudo-class within property', () => {
  const result = createStyles({
    $root: {
      color: {
        $default: 'red',
        ':hover': 'blue',
      },
    },
  })
  expect(result.$root.classNames).toEqual([])
  // Should have at least two stylesheets (default + :hover)
  expect(result.$root.stylesheets.length).toBeGreaterThanOrEqual(2)
})

test('createStyles: $host with compound selectors', () => {
  const result = createStyles({
    $host: {
      color: {
        $compoundSelectors: {
          '[data-theme="dark"]': {
            $default: 'white',
            ':hover': 'lightgray',
          },
        },
      },
    },
  })
  expect(result.$host.classNames).toEqual([])
  expect(result.$host.stylesheets.length).toBeGreaterThanOrEqual(1)
})

test('createStyles: $top with @media at-rule', () => {
  const result = createStyles({
    $top: {
      '@media (prefers-color-scheme: dark)': {
        '--bg': 'black',
      },
    },
  })
  expect(result.$top.classNames).toEqual([])
  expect(result.$top.stylesheets.some((s) => s.startsWith('@media'))).toBe(true)
})

test('createStyles: enum property with valid value', () => {
  expect(() => {
    createStyles({ flex: { display: 'flex' } })
  }).not.toThrow()
})

test('createStyles: enum-or-number property with valid number', () => {
  expect(() => {
    createStyles({ grow: { 'flex-grow': 2 } })
  }).not.toThrow()
})

test('createStyles: border shorthand is string-or-number', () => {
  expect(() => {
    createStyles({ border: { border: '1px solid black' } })
  }).not.toThrow()
})

test('createKeyframes: multiple named keyframe sets in one call', () => {
  const result = createKeyframes('anim', {
    '0%': { opacity: 0 },
    '50%': { opacity: 0.5 },
    '100%': { opacity: 1 },
  })
  const { anim } = result
  expect(anim.id.startsWith('anim_')).toBeTruthy()
  const out = anim()
  expect(out.stylesheets.length).toBe(1)
  expect(out.stylesheets[0]).toContain('@keyframes')
  expect(out.stylesheets[0]).toContain('0%')
  expect(out.stylesheets[0]).toContain('100%')
})
