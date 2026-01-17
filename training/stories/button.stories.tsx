import { story } from 'plaited/testing'
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { buttonStyles } from './button.css.ts'

/**
 * Primary button with hover, focus, and active states.
 */
const PrimaryButton: FT<{ disabled?: boolean }> = ({ disabled, children }) => (
  <button
    {...joinStyles(buttonStyles.btn, buttonStyles.primary)}
    disabled={disabled}
  >
    {children}
  </button>
)

/**
 * Secondary button with muted styling.
 */
const SecondaryButton: FT<{ disabled?: boolean }> = ({ disabled, children }) => (
  <button
    {...joinStyles(buttonStyles.btn, buttonStyles.secondary)}
    disabled={disabled}
  >
    {children}
  </button>
)

/**
 * Outline button with transparent background.
 */
const OutlineButton: FT = ({ children }) => (
  <button {...joinStyles(buttonStyles.btn, buttonStyles.outline)}>{children}</button>
)

/**
 * Icon button with square shape and icon content.
 */
const IconButton: FT<{
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
  round?: boolean
  'aria-label': string
}> = ({ disabled, variant = 'primary', round = false, 'aria-label': ariaLabel, children }) => (
  <button
    {...joinStyles(buttonStyles.btn, buttonStyles.icon, buttonStyles[variant], round && buttonStyles.iconRound)}
    disabled={disabled}
    aria-label={ariaLabel}
  >
    {children}
  </button>
)

/**
 * Heart icon SVG.
 */
const HeartIcon: FT = () => (
  <svg
    {...joinStyles(buttonStyles.iconSvg)}
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
    aria-hidden='true'
  >
    <path d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z' />
  </svg>
)

/**
 * Star icon SVG.
 */
const StarIcon: FT = () => (
  <svg
    {...joinStyles(buttonStyles.iconSvg)}
    viewBox='0 0 24 24'
    xmlns='http://www.w3.org/2000/svg'
    aria-hidden='true'
  >
    <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
  </svg>
)

export const meta = {
  title: 'Training/Button',
}

export const primaryButton = story({
  intent: 'Create a primary button with hover and focus states',
  template: () => <PrimaryButton>Click Me</PrimaryButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const primaryButtonDisabled = story({
  intent: 'Create a disabled primary button that cannot be clicked',
  template: () => <PrimaryButton disabled>Disabled</PrimaryButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const secondaryButton = story({
  intent: 'Create a secondary button with muted gray styling',
  template: () => <SecondaryButton>Secondary</SecondaryButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const outlineButton = story({
  intent: 'Create an outline button with border and transparent background',
  template: () => <OutlineButton>Outline</OutlineButton>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const iconButton = story({
  intent: 'Create an icon button with a heart icon that is square-shaped and accessible',
  template: () => (
    <IconButton
      variant='primary'
      aria-label='Like'
    >
      <HeartIcon />
    </IconButton>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const iconButtonRound = story({
  intent: 'Create a round icon button with a star icon',
  template: () => (
    <IconButton
      variant='primary'
      round
      aria-label='Favorite'
    >
      <StarIcon />
    </IconButton>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const iconButtonSecondary = story({
  intent: 'Create a secondary variant icon button with muted styling',
  template: () => (
    <IconButton
      variant='secondary'
      aria-label='Settings'
    >
      <svg
        {...joinStyles(buttonStyles.iconSvg)}
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden='true'
      >
        <path d='M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.64l-1.92-3.32c-.12-.22-.37-.31-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94L14.4 2.81c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.09-.47 0-.59.22L2.74 8.87c-.12.22-.08.5.1.64l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.64l1.92 3.32c.12.22.37.31.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.5-.12-.64l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z' />
      </svg>
    </IconButton>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const iconButtonOutline = story({
  intent: 'Create an outline variant icon button with transparent background',
  template: () => (
    <IconButton
      variant='outline'
      aria-label='Close'
    >
      <svg
        {...joinStyles(buttonStyles.iconSvg)}
        viewBox='0 0 24 24'
        xmlns='http://www.w3.org/2000/svg'
        aria-hidden='true'
      >
        <path d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z' />
      </svg>
    </IconButton>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
