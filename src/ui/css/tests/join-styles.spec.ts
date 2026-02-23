import { expect, test } from 'bun:test'
import { createHostStyles, createStyles, createTokens, joinStyles } from 'plaited/ui'

test('joinStyles: combines element styles with host styles', () => {
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

test('joinStyles: combines styles with design token references', () => {
  const { spacing } = createTokens('spacing', {
    small: { $value: '8px' },
    medium: { $value: '16px' },
    large: { $value: '24px' },
  })

  const { typography } = createTokens('typography', {
    heading: { $value: '2rem' },
    body: { $value: '1rem' },
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
