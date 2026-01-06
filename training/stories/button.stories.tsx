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
