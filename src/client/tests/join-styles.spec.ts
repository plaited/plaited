import { expect, test } from 'bun:test'
import { createStyles, joinStyles } from 'plaited/client'

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
  const host = createStyles({
    $host: {
      color: 'red',
    },
  })
  expect(joinStyles(testStyles.button, testStyles.small, host.$host)).toMatchSnapshot()
})

test('joinStyles: combines styles with $root custom-property declarations', () => {
  const rootDecls = createStyles({
    $root: {
      '--spacing-small': '8px',
      '--spacing-medium': '16px',
      '--spacing-large': '24px',
      '--typography-heading': '2rem',
      '--typography-body': '1rem',
    },
  })

  const baseStyles = createStyles({
    container: {
      padding: 'var(--spacing-medium)',
      fontSize: 'var(--typography-body)',
    },
  })

  const variantStyles = createStyles({
    large: {
      padding: 'var(--spacing-large)',
      fontSize: 'var(--typography-heading)',
    },
  })

  const hostStylesVariant = createStyles({
    $host: {
      margin: 'var(--spacing-small)',
    },
  })

  const combined = joinStyles(baseStyles.container, variantStyles.large, hostStylesVariant.$host, rootDecls.$root)
  expect(combined).toMatchSnapshot()
})
