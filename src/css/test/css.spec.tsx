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

// css.tokens tests
test('tokens: simple token with $value', () => {
  const designTokens = css.tokens('theme', {
    primaryColor: {
      $value: '#007bff',
    },
    fontSize: {
      $value: '16px',
    },
  })
  expect(designTokens.primaryColor()).toBe('var(--theme-primary-color)')
  expect(designTokens.primaryColor.styles).toMatchSnapshot()
  expect(designTokens.fontSize()).toBe('var(--theme-font-size)')
  expect(designTokens.fontSize.styles).toMatchSnapshot()
})

test('tokens: token with array values', () => {
  const designTokens = css.tokens('spacing', {
    margin: {
      $value: ['10px', '20px', '30px', '40px'],
    },
    padding: {
      $value: ['5px', '10px'],
      $csv: true,
    },
  })
  expect(designTokens.margin()).toBe('var(--spacing-margin)')
  expect(designTokens.margin.styles).toMatchSnapshot()
  expect(designTokens.padding()).toBe('var(--spacing-padding)')
  expect(designTokens.padding.styles).toMatchSnapshot()
})

test('tokens: function token values', () => {
  const designTokens = css.tokens('effects', {
    shadow: {
      $value: {
        $function: 'drop-shadow',
        $arguments: ['2px', '4px', '6px', 'rgba(0,0,0,0.1)'],
      },
    },
    gradient: {
      $value: {
        $function: 'linear-gradient',
        $arguments: ['45deg', '#ff0000', '#00ff00'],
        $csv: true,
      },
    },
  })
  expect(designTokens.shadow()).toBe('var(--effects-shadow)')
  expect(designTokens.shadow.styles).toMatchSnapshot()
  expect(designTokens.gradient()).toBe('var(--effects-gradient)')
  expect(designTokens.gradient.styles).toMatchSnapshot()
})

test('tokens: nested token statements with selectors', () => {
  const designTokens = css.tokens('interactive', {
    buttonColor: {
      $default: {
        $value: 'blue',
      },
      ':hover': {
        $value: 'darkblue',
      },
      ':active': {
        $value: 'navy',
      },
      '@media (max-width: 768px)': {
        $value: 'lightblue',
      },
    },
  })
  expect(designTokens.buttonColor()).toBe('var(--interactive-button-color)')
  expect(designTokens.buttonColor.styles).toMatchSnapshot()
})

test('tokens: compound selectors', () => {
  const designTokens = css.tokens('state', {
    color: {
      $default: {
        $value: 'black',
      },
      $compoundSelectors: {
        '.dark': {
          $value: 'white',
        },
        '[data-theme="blue"]': {
          $value: 'blue',
        },
        '.large': {
          ':hover': {
            $value: 'gray',
          },
        },
      },
    },
  })
  expect(designTokens.color()).toBe('var(--state-color)')
  expect(designTokens.color.styles).toMatchSnapshot()
})

test('tokens: token references', () => {
  const baseTokens = css.tokens('base', {
    primary: {
      $value: '#007bff',
    },
  })

  const derivedTokens = css.tokens('derived', {
    buttonBg: {
      $value: baseTokens.primary,
    },
  })

  expect(derivedTokens.buttonBg()).toBe('var(--derived-button-bg)')
  expect(derivedTokens.buttonBg.styles).toMatchSnapshot()
})

test('tokens: complex nested structure', () => {
  const designTokens = css.tokens('complex', {
    card: {
      $default: {
        $value: {
          $function: 'rgba',
          $arguments: ['255', '255', '255', '0.9'],
          $csv: true,
        },
      },
      '[data-variant="dark"]': {
        $value: {
          $function: 'rgba',
          $arguments: ['0', '0', '0', '0.9'],
          $csv: true,
        },
      },
      $compoundSelectors: {
        '.elevated': {
          $default: {
            $value: '#ffffff',
          },
          ':hover': {
            $value: '#f0f0f0',
          },
        },
      },
    },
  })
  expect(designTokens.card()).toBe('var(--complex-card)')
  expect(designTokens.card.styles).toMatchSnapshot()
})

test('tokens: array of function values', () => {
  const designTokens = css.tokens('transform', {
    animation: {
      $value: [
        {
          $function: 'translateX',
          $arguments: '10px',
        },
        {
          $function: 'rotate',
          $arguments: '45deg',
        },
        {
          $function: 'scale',
          $arguments: ['1.2', '1.2'],
          $csv: true,
        },
      ],
    },
  })
  expect(designTokens.animation()).toBe('var(--transform-animation)')
  expect(designTokens.animation.styles).toMatchSnapshot()
})
