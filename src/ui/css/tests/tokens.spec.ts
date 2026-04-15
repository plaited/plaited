import { expect, test } from 'bun:test'
import { createHostStyles, createStyles, createTokens } from 'plaited/ui'

test('createTokens: simple token with $value', () => {
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

test('createTokens: token with array values', () => {
  const { typography } = createTokens('typography', {
    margin: {
      $value: ['10px', '20px', '30px', '40px'],
      $csv: false,
    },
    fontFamily: {
      $value: ['"Helvetica Neue"', 'Arial', 'sans-serif'],
      $csv: true,
    },
  })
  expect(typography.margin()).toBe('var(--typography-margin)')
  expect(typography.margin.stylesheets).toMatchSnapshot()
  expect(typography.fontFamily()).toBe('var(--typography-font-family)')
  expect(typography.fontFamily.stylesheets).toMatchSnapshot()
})

test('createTokens: function token values', () => {
  const { effects } = createTokens('effects', {
    shadow: {
      $value: {
        $function: 'drop-shadow',
        $arguments: ['2px', '4px', '6px', 'rgba(0,0,0,0.1)'],
        $csv: false,
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

test('createTokens: nested scales for size tokens', () => {
  const { sizes } = createTokens('sizes', {
    icon: {
      sm: { $value: '16px' },
      md: { $value: '24px' },
      lg: { $value: '32px' },
    },
    button: {
      sm: { $value: '32px' },
      md: { $value: '40px' },
      lg: { $value: '48px' },
    },
  })
  expect(sizes.icon.sm()).toBe('var(--sizes-icon-sm)')
  expect(sizes.icon.md()).toBe('var(--sizes-icon-md)')
  expect(sizes.icon.lg()).toBe('var(--sizes-icon-lg)')
  expect(sizes.button.sm()).toBe('var(--sizes-button-sm)')
  expect(sizes.icon.sm.stylesheets).toMatchSnapshot()
  expect(sizes.button.lg.stylesheets).toMatchSnapshot()
})

test('createTokens: nested scales for color palette', () => {
  const { gray } = createTokens('gray', {
    50: { $value: '#fafafa' },
    100: { $value: '#f5f5f5' },
    200: { $value: '#eeeeee' },
    900: { $value: '#212121' },
  })
  expect(gray[50]()).toBe('var(--gray-50)')
  expect(gray[100]()).toBe('var(--gray-100)')
  expect(gray[900]()).toBe('var(--gray-900)')
  expect(gray[50].stylesheets).toMatchSnapshot()
})

test('createTokens: token references', () => {
  const { base } = createTokens('base', {
    primary: {
      $value: '#007bff',
    },
  })

  const { derived } = createTokens('derived', {
    buttonBg: {
      $value: base.primary,
    },
  })

  expect(derived.buttonBg()).toBe('var(--derived-button-bg)')
  expect(derived.buttonBg.stylesheets).toMatchSnapshot()
})

test('createTokens: array of function values', () => {
  const { transform } = createTokens('transform', {
    animation: {
      $value: [
        {
          $function: 'translateX',
          $arguments: ['10px'],
          $csv: false,
        },
        {
          $function: 'rotate',
          $arguments: ['45deg'],
          $csv: false,
        },
        {
          $function: 'scale',
          $arguments: ['1.2', '1.2'],
          $csv: true,
        },
      ],
      $csv: false,
    },
  })
  expect(transform.animation()).toBe('var(--transform-animation)')
  expect(transform.animation.stylesheets).toMatchSnapshot()
})

test('createTokens: integration with createStyles', () => {
  const { theme } = createTokens('theme', {
    primary: { $value: '#007bff' },
    secondary: { $value: '#6c757d' },
    fontSize: { $value: '16px' },
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

test('createTokens: integration with createHostStyles', () => {
  const { colors } = createTokens('colors', {
    text: { $value: '#333' },
    background: { $value: '#fff' },
  })

  const host = createHostStyles({
    color: colors.text,
    backgroundColor: colors.background,
    padding: '20px',
  })

  expect(host).toMatchSnapshot()
})

test('createTokens: multiple token groups combined', () => {
  const { layout } = createTokens('layout', {
    maxWidth: { $value: '1200px' },
    gap: { $value: '20px' },
  })

  const { motion } = createTokens('motion', {
    duration: { $value: '300ms' },
    easing: { $value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
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

  expect(layout.maxWidth.stylesheets).toBeDefined()
  expect(layout.gap.stylesheets).toBeDefined()
  expect(motion.duration.stylesheets).toBeDefined()
  expect(motion.easing.stylesheets).toBeDefined()
})

test('createTokens: used as CSS values in styles', () => {
  const { sizes } = createTokens('sizes', {
    containerWidth: { $value: '1200px' },
    headerHeight: { $value: '64px' },
    sidebarWidth: { $value: '250px' },
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
