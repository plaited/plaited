import axe from 'axe-core'
import type { Trigger } from '../../behavioral/b-program.js'
import { PLAITED_FIXTURE } from './plaited-fixture.constants.js'
import { AccessibilityError } from './errors.js'
import type { CheckA11y, CheckA11yDetails } from './testing.types.js'

export const CHECK_A11Y = 'CHECK_A11Y'

export const useCheckA11y = (trigger: Trigger) => {
  const checkA11y: CheckA11y = async ({ exclude, rules, config = {} }) => {
    trigger<CheckA11yDetails>({ type: CHECK_A11Y, detail: [{ exclude, rules, config }] })
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
  return checkA11y
}
