import { expect, test } from 'bun:test'
import { createHostStyles, createKeyframes, createStyles, createTokens, joinStyles } from 'plaited'
import { isElementStylesObject, isHostStylesObject, isStylesObject } from '../css.utils.ts'

test('create: supports simple rules', () => {
  const testStyles = createStyles({
    simpleRules: {
      fontSize: `16px`,
      lineHeight: 1.5,
      color: 'rgb(60,60,60)',
    },
  })
  expect(testStyles.simpleRules).toMatchSnapshot()
})

test('create: supports custom props', () => {
  const testStyles = createStyles({
    customProps: {
      '--customColor': 'red',
      '--custom-color': 'red',
    },
  })
  expect(testStyles.customProps).toMatchSnapshot()
})

test('create: supports pseudo-classes', () => {
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

test('create: supports pseudo-elements', () => {
  const testStyles = createStyles({
    pseudoElement: {
      color: {
        '::placeholder': '#999',
      },
    },
  })
  expect(testStyles.pseudoElement).toMatchSnapshot()
})

test('create: supports media query', () => {
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

test('create: supports complex rules', () => {
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

test('create: works with JSX via spread operator', () => {
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

// host tests
test('host: supports simple rules', () => {
  const host = createHostStyles({
    fontSize: `16px`,
    lineHeight: 1.5,
    color: 'rgb(60,60,60)',
  })
  expect(host).toMatchSnapshot()
})

test('host: supports custom props', () => {
  const host = createHostStyles({
    '--customColor': 'red',
    '--custom-color': 'red',
  })
  expect(host).toMatchSnapshot()
})

test('host: supports pseudo-classes', () => {
  const host = createHostStyles({
    backgroundColor: {
      $default: 'lightblue',
      ':hover': 'blue',
      ':active': 'darkblue',
    },
  })
  expect(host).toMatchSnapshot()
})

test('host: supports pseudo-elements', () => {
  const host = createHostStyles({
    color: {
      '::placeholder': '#999',
    },
  })
  expect(host).toMatchSnapshot()
})

test('host: supports media query', () => {
  const host = createHostStyles({
    width: {
      $default: 800,
      '@media (max-width: 800px)': '100%',
      '@media (min-width: 1540px)': 1366,
    },
  })
  expect(host).toMatchSnapshot()
})

test('host: supports complex rules', () => {
  const host = createHostStyles({
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
  const host = createHostStyles({
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
  const testKeyframes = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: 'scale(1.1)' },
    '100%': { transform: 'scale(1)' },
  })
  expect(testKeyframes.id.startsWith('pulse_')).toBeTruthy()
  expect(testKeyframes()).toMatchSnapshot()
})

test('join', () => {
  const testStyles = createStyles({
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
  const host = createHostStyles({
    color: 'red',
  })
  expect(joinStyles(testStyles.button, testStyles.small, host)).toMatchSnapshot()
})

// tokens tests
test('tokens: simple token with $value', () => {
  const { theme } = createTokens('theme', {
    primaryColor: {
      $value: '#007bff',
    },
    fontSize: {
      $value: '16px',
    },
  })
  expect(theme.primaryColor()).toBe('var(--theme-primary-color)')
  expect(theme.primaryColor.stylesheets).toMatchSnapshot()
  expect(theme.fontSize()).toBe('var(--theme-font-size)')
  expect(theme.fontSize.stylesheets).toMatchSnapshot()
})

test('tokens: token with array values', () => {
  const { spacing } = createTokens('spacing', {
    margin: {
      $value: ['10px', '20px', '30px', '40px'],
    },
    fontFamily: {
      $value: ['"Helvetica Neue"', 'Arial', 'sans-serif'],
      $csv: true,
    },
  })
  expect(spacing.margin()).toBe('var(--spacing-margin)')
  expect(spacing.margin.stylesheets).toMatchSnapshot()
  expect(spacing.fontFamily()).toBe('var(--spacing-font-family)')
  expect(spacing.fontFamily.stylesheets).toMatchSnapshot()
})

test('tokens: function token values', () => {
  const { effects } = createTokens('effects', {
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
  expect(effects.shadow()).toBe('var(--effects-shadow)')
  expect(effects.shadow.stylesheets).toMatchSnapshot()
  expect(effects.gradient()).toBe('var(--effects-gradient)')
  expect(effects.gradient.stylesheets).toMatchSnapshot()
})

test('tokens: nested token statements with selectors', () => {
  const { interactive } = createTokens('interactive', {
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
  expect(interactive.buttonColor()).toBe('var(--interactive-button-color)')
  expect(interactive.buttonColor.stylesheets).toMatchSnapshot()
})

test('tokens: compound selectors', () => {
  const { state } = createTokens('state', {
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
  expect(state.color()).toBe('var(--state-color)')
  expect(state.color.stylesheets).toMatchSnapshot()
})

test('tokens: token references', () => {
  const { base } = createTokens('base', {
    primary: {
      $value: '#007bff',
    },
  })

  const { derived } = createTokens('derived', {
    buttonBg: {
      $value: base.primary, // Pass the reference directly, not invoked
    },
  })

  expect(derived.buttonBg()).toBe('var(--derived-button-bg)')
  expect(derived.buttonBg.stylesheets).toMatchSnapshot()
})

test('tokens: complex nested structure', () => {
  const { complex } = createTokens('complex', {
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
  expect(complex.card()).toBe('var(--complex-card)')
  expect(complex.card.stylesheets).toMatchSnapshot()
})

test('tokens: array of function values', () => {
  const { transform } = createTokens('transform', {
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
  expect(transform.animation()).toBe('var(--transform-animation)')
  expect(transform.animation.stylesheets).toMatchSnapshot()
})

// Integration tests: tokens with other CSS utilities
test('tokens: integration with create', () => {
  const { theme } = createTokens('theme', {
    primary: {
      $value: '#007bff',
    },
    secondary: {
      $value: '#6c757d',
    },
    fontSize: {
      $value: '16px',
    },
  })

  const testStyles = createStyles({
    button: {
      backgroundColor: theme.primary,
      fontSize: theme.fontSize,
      color: 'white',
      ':hover': {
        backgroundColor: theme.secondary,
      },
    },
  })

  expect(testStyles.button).toMatchSnapshot()
})

test('tokens: integration with host', () => {
  const { colors } = createTokens('colors', {
    text: {
      $value: '#333',
      $compoundSelectors: {
        '.dark': {
          $value: '#fff',
        },
      },
    },
    background: {
      $value: '#fff',
      $compoundSelectors: {
        '.dark': {
          $value: '#222',
        },
      },
    },
  })

  const host = createHostStyles({
    color: colors.text,
    backgroundColor: colors.background,
    padding: '20px',
  })

  expect(host).toMatchSnapshot()
})

test('tokens: integration with join', () => {
  const { spacing } = createTokens('spacing', {
    small: {
      $value: '8px',
    },
    medium: {
      $value: '16px',
    },
    large: {
      $value: '24px',
    },
  })

  const { typography } = createTokens('typography', {
    heading: {
      $value: '2rem',
    },
    body: {
      $value: '1rem',
    },
  })

  const baseStyles = createStyles({
    container: {
      padding: spacing.medium,
      fontSize: typography.body,
    },
  })

  const variantStyles = createStyles({
    large: {
      padding: spacing.large,
      fontSize: typography.heading,
    },
  })

  const hostStylesVariant = createHostStyles({
    margin: spacing.small,
  })

  const combined = joinStyles(baseStyles.container, variantStyles.large, hostStylesVariant)

  expect(combined).toMatchSnapshot()
})

test('tokens: multiple token groups combined', () => {
  const { layout } = createTokens('layout', {
    maxWidth: {
      $value: '1200px',
      '@media (max-width: 768px)': {
        $value: '100%',
      },
    },
    gap: {
      $value: '20px',
    },
  })

  const { motion } = createTokens('motion', {
    duration: {
      $value: '300ms',
    },
    easing: {
      $value: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  })

  const { transition } = createTokens('transition', {
    example: {
      $value: ['all', motion.duration, motion.easing],
      $csv: false,
    },
  })

  const testStyles = createStyles({
    grid: {
      maxWidth: layout.maxWidth,
      gap: layout.gap,
      transition: transition.example,
    },
  })

  expect(testStyles.grid).toMatchSnapshot()

  // Test that token styles are properly defined
  expect(layout.maxWidth.stylesheets).toBeDefined()
  expect(layout.gap.stylesheets).toBeDefined()
  expect(motion.duration.stylesheets).toBeDefined()
  expect(motion.easing.stylesheets).toBeDefined()
})

test('tokens: with keyframes', () => {
  const { animations } = createTokens('animations', {
    scale: {
      $value: {
        $function: 'scale',
        $arguments: '1.2',
      },
    },
    rotate: {
      $value: {
        $function: 'rotate',
        $arguments: '360deg',
      },
    },
  })

  const spin = createKeyframes('spin', {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: animations.rotate },
  })

  const pulse = createKeyframes('pulse', {
    '0%': { transform: 'scale(1)' },
    '50%': { transform: animations.scale },
    '100%': { transform: 'scale(1)' },
  })

  expect(spin()).toMatchSnapshot()
  expect(pulse()).toMatchSnapshot()
})

test('tokens: used as CSS values in styles', () => {
  const { sizes } = createTokens('sizes', {
    containerWidth: {
      $value: '1200px',
    },
    headerHeight: {
      $value: '64px',
    },
    sidebarWidth: {
      $value: '250px',
    },
  })

  const testStyles = createStyles({
    container: {
      maxWidth: sizes.containerWidth,
      margin: '0 auto',
    },
    header: {
      height: sizes.headerHeight,
      position: 'sticky',
      top: 0,
    },
    sidebar: {
      width: sizes.sidebarWidth,
      flexShrink: 0,
    },
  })

  expect(testStyles.container).toMatchSnapshot()
  expect(testStyles.header).toMatchSnapshot()
  expect(testStyles.sidebar).toMatchSnapshot()
})

// Type guard tests
test('isElementStylesObject: returns true for valid ElementStylesObject', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
      padding: '10px',
    },
  })
  expect(isElementStylesObject(elementStyles.button)).toBe(true)
})

test('isElementStylesObject: returns false for HostStylesObject', () => {
  const hostStyles = createHostStyles({
    color: 'red',
  })
  expect(isElementStylesObject(hostStyles)).toBe(false)
})

test('isElementStylesObject: returns false for invalid inputs', () => {
  expect(isElementStylesObject(null)).toBe(false)
  expect(isElementStylesObject(undefined)).toBe(false)
  expect(isElementStylesObject('string')).toBe(false)
  expect(isElementStylesObject(123)).toBe(false)
  expect(isElementStylesObject({})).toBe(false)
  expect(isElementStylesObject({ classNames: 'not-array' })).toBe(false)
  expect(isElementStylesObject({ stylesheets: [] })).toBe(false)
  expect(isElementStylesObject({ classNames: [], stylesheets: 'not-array' })).toBe(false)
})

test('isHostStylesObject: returns true for valid HostStylesObject', () => {
  const hostStyles = createHostStyles({
    color: 'red',
    padding: '20px',
  })
  expect(isHostStylesObject(hostStyles)).toBe(true)
})

test('isHostStylesObject: returns false for ElementStylesObject', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
    },
  })
  expect(isHostStylesObject(elementStyles.button)).toBe(false)
})

test('isHostStylesObject: returns false for invalid inputs', () => {
  expect(isHostStylesObject(null)).toBe(false)
  expect(isHostStylesObject(undefined)).toBe(false)
  expect(isHostStylesObject('string')).toBe(false)
  expect(isHostStylesObject(123)).toBe(false)
  expect(isHostStylesObject({})).toBe(false)
  expect(isHostStylesObject({ classNames: [] })).toBe(false)
  expect(isHostStylesObject({ stylesheets: 'not-array' })).toBe(false)
  expect(isHostStylesObject({ classNames: [], stylesheets: [] })).toBe(false)
})

test('isStylesObject: returns true for ElementStylesObject', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
    },
  })
  expect(isStylesObject(elementStyles.button)).toBe(true)
})

test('isStylesObject: returns true for HostStylesObject', () => {
  const hostStyles = createHostStyles({
    color: 'red',
  })
  expect(isStylesObject(hostStyles)).toBe(true)
})

test('isStylesObject: returns true for joined styles', () => {
  const elementStyles = createStyles({
    button: {
      color: 'blue',
    },
  })
  const hostStyles = createHostStyles({
    padding: '10px',
  })
  const joined = joinStyles(elementStyles.button, hostStyles)
  expect(isStylesObject(joined)).toBe(true)
})

test('isStylesObject: returns false for invalid inputs', () => {
  expect(isStylesObject(null)).toBe(false)
  expect(isStylesObject(undefined)).toBe(false)
  expect(isStylesObject('string')).toBe(false)
  expect(isStylesObject(123)).toBe(false)
  expect(isStylesObject({})).toBe(false)
  expect(isStylesObject({ random: 'object' })).toBe(false)
})
