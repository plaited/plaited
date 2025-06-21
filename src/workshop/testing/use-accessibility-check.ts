import axe from 'axe-core'
import type { Trigger } from '../../behavioral/b-program.js'
import { PLAITED_FIXTURE, FIXTURE_EVENTS } from './testing.constants.js'
import { AccessibilityError } from './errors.js'
import type { AccessibilityCheck, AccessibilityCheckDetails } from './testing.types.js'

export const useAccessibilityCheck = (trigger: Trigger) => {
  const accessibilityCheck: AccessibilityCheck = async ({ exclude, rules, config = {} }) => {
    trigger<AccessibilityCheckDetails>({
      type: FIXTURE_EVENTS.accessibility_check,
      detail: [{ exclude, rules, config }],
    })
    axe.configure({
      reporter: 'no-passes',
      ...config,
    })
    const { violations } = await axe.run(
      {
        include: PLAITED_FIXTURE,
        exclude,
      },
      { reporter: 'no-passes', rules },
    )
    axe.reset()
    if (violations.length) throw new AccessibilityError(JSON.stringify(violations))
  }
  return accessibilityCheck
}
