import { story } from 'plaited/testing'
import type { FT } from 'plaited/ui'
import { joinStyles } from 'plaited/ui'
import { badgeStyles } from './badge.css.ts'

/**
 * Primary badge for general labels.
 */
const PrimaryBadge: FT = ({ children }) => (
  <span {...joinStyles(badgeStyles.badge, badgeStyles.primary)}>{children}</span>
)

/**
 * Success badge for positive states.
 */
const SuccessBadge: FT = ({ children }) => (
  <span {...joinStyles(badgeStyles.badge, badgeStyles.success)}>{children}</span>
)

/**
 * Warning badge for caution states.
 */
const WarningBadge: FT = ({ children }) => (
  <span {...joinStyles(badgeStyles.badge, badgeStyles.warning)}>{children}</span>
)

/**
 * Danger badge for error states.
 */
const DangerBadge: FT = ({ children }) => <span {...joinStyles(badgeStyles.badge, badgeStyles.danger)}>{children}</span>

/**
 * Pill-shaped badge with rounded ends.
 */
const PillBadge: FT<{ variant?: 'primary' | 'success' | 'warning' | 'danger' }> = ({
  variant = 'primary',
  children,
}) => <span {...joinStyles(badgeStyles.badge, badgeStyles[variant], badgeStyles.pill)}>{children}</span>

export const meta = {
  title: 'Training/Badge',
}

export const primaryBadge = story({
  intent: 'Create a primary badge for labeling content',
  template: () => <PrimaryBadge>New</PrimaryBadge>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const successBadge = story({
  intent: 'Create a success badge for positive status',
  template: () => <SuccessBadge>Active</SuccessBadge>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const warningBadge = story({
  intent: 'Create a warning badge for caution states',
  template: () => <WarningBadge>Pending</WarningBadge>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const dangerBadge = story({
  intent: 'Create a danger badge for error or critical states',
  template: () => <DangerBadge>Error</DangerBadge>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const pillBadge = story({
  intent: 'Create a pill-shaped badge with fully rounded corners',
  template: () => <PillBadge variant='success'>Online</PillBadge>,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const badgeGroup = story({
  intent: 'Create a set of badges showing different status types',
  template: () => (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <PrimaryBadge>Primary</PrimaryBadge>
      <SuccessBadge>Success</SuccessBadge>
      <WarningBadge>Warning</WarningBadge>
      <DangerBadge>Danger</DangerBadge>
    </div>
  ),
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})
