import { story } from 'plaited/testing'
import { Wizard } from './wizard.tsx'

export const meta = {
  title: 'Training/Wizard',
}

export const wizardDefault = story({
  intent: 'Create a multi-step wizard with sequential navigation',
  template: () => <Wizard />,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const wizardSequentialNavigation = story({
  intent: 'Create a wizard that enforces step sequence and blocks skipping ahead',
  template: () => <Wizard />,
  play: async ({ assert, findByTarget, findByAttribute, fireEvent, wait }) => {
    const content = await findByTarget('content')

    // Initial state - Step 1
    assert({
      given: 'initial render',
      should: 'show step 1',
      actual: content?.textContent?.includes('Step 1'),
      expected: true,
    })

    // Try clicking step 3 directly - should be blocked
    const step3Button = await findByAttribute<HTMLButtonElement>('data-step', '2')
    step3Button && (await fireEvent(step3Button, 'click'))
    await wait(10)

    assert({
      given: 'clicking step 3 without completing step 1',
      should: 'still show step 1 (blocked by bThread)',
      actual: content?.textContent?.includes('Step 1'),
      expected: true,
    })

    // Click Next to validate step 1 and advance
    const next = await findByTarget<HTMLButtonElement>('next')
    next && (await fireEvent(next, 'click'))
    await wait(10)

    assert({
      given: 'clicking Next after step 1',
      should: 'show step 2',
      actual: content?.textContent?.includes('Step 2'),
      expected: true,
    })

    // Now step 1 should show checkmark (validated)
    const step1Button = await findByAttribute<HTMLButtonElement>('data-step', '0')
    assert({
      given: 'step 1 validated',
      should: 'show checkmark in nav',
      actual: step1Button?.textContent?.includes('✓'),
      expected: true,
    })
  },
})

export const wizardFinishBlocking = story({
  intent: 'Create a wizard that blocks finish until all steps are validated',
  template: () => <Wizard />,
  play: async ({ assert, findByTarget, fireEvent, wait }) => {
    const next = await findByTarget<HTMLButtonElement>('next')
    const content = await findByTarget('content')

    // Advance through all steps
    next && (await fireEvent(next, 'click'))
    await wait(10)
    next && (await fireEvent(next, 'click'))
    await wait(10)

    // Now on step 3, finish should be visible
    const finish = await findByTarget<HTMLButtonElement>('finish')
    assert({
      given: 'on final step',
      should: 'show finish button',
      actual: finish?.hidden,
      expected: false,
    })

    // Click finish
    finish && (await fireEvent(finish, 'click'))
    await wait(10)

    assert({
      given: 'clicking finish after all steps',
      should: 'show completion message',
      actual: content?.textContent?.includes('Complete'),
      expected: true,
    })
  },
})

export const wizardAccessibility = story({
  intent: 'Create an accessible wizard with proper ARIA attributes and live regions',
  template: () => <Wizard />,
  play: async ({ accessibilityCheck, findByTarget, findByAttribute, assert }) => {
    await accessibilityCheck({})

    const nav = await findByTarget('nav')
    assert({
      given: 'wizard navigation',
      should: 'have navigation role',
      actual: nav?.getAttribute('role'),
      expected: 'navigation',
    })

    const content = await findByTarget('content')
    assert({
      given: 'wizard content',
      should: 'have aria-live for step change announcements',
      actual: content?.getAttribute('aria-live'),
      expected: 'polite',
    })

    const currentStep = await findByAttribute('aria-current', 'step')
    assert({
      given: 'current step',
      should: 'have aria-current=step',
      actual: currentStep?.getAttribute('aria-current'),
      expected: 'step',
    })
  },
})
