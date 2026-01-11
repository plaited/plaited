import { story } from 'plaited/testing'
import { ValidatedInput } from './validated-input.tsx'

export const meta = {
  title: 'Training/ValidatedInput',
}

export const validatedInputDefault = story({
  intent: 'Create a form input that validates on change',
  template: () => <ValidatedInput />,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const validatedInputMinLength = story({
  intent: 'Create a form input that requires minimum 3 characters and blocks submit when invalid',
  template: () => (
    <form>
      <ValidatedInput min-length="3" />
    </form>
  ),
  play: async ({ assert, findByTarget, wait }) => {
    const input = await findByTarget<HTMLInputElement>('input')
    const error = await findByTarget('error')

    // Initial state - no error message yet
    assert({
      given: 'initial render',
      should: 'show no error message',
      actual: error?.textContent,
      expected: '',
    })

    // Type short value - triggers validation
    if (input) {
      input.value = 'ab'
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }
    await wait(10)

    assert({
      given: 'input too short (2 chars)',
      should: 'show validation error',
      actual: error?.textContent,
      expected: 'Must be at least 3 characters',
    })

    // Type valid value
    if (input) {
      input.value = 'abc'
      input.dispatchEvent(new InputEvent('input', { bubbles: true }))
    }
    await wait(10)

    assert({
      given: 'input meets minimum length (3 chars)',
      should: 'clear error message',
      actual: error?.textContent,
      expected: '',
    })
  },
})

export const validatedInputAccessibility = story({
  intent: 'Create an accessible validated input with error announcements for screen readers',
  template: () => <ValidatedInput min-length="3" />,
  play: async ({ accessibilityCheck, findByTarget, assert }) => {
    await accessibilityCheck({})

    const error = await findByTarget('error')
    assert({
      given: 'error element',
      should: 'have role="alert" for screen reader announcements',
      actual: error?.getAttribute('role'),
      expected: 'alert',
    })

    const input = await findByTarget('input')
    assert({
      given: 'input element',
      should: 'be described by error element',
      actual: input?.getAttribute('aria-describedby'),
      expected: 'error',
    })
  },
})
