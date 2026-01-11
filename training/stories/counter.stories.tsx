import { story } from 'plaited/testing'
import { Counter } from './counter.tsx'

export const meta = {
  title: 'Training/Counter',
}

export const counterDefault = story({
  intent: 'Create a counter with increment and decrement buttons',
  template: () => <Counter />,
  play: async ({ accessibilityCheck }) => {
    await accessibilityCheck({})
  },
})

export const counterWithLimits = story({
  intent: 'Create a counter that blocks increment at max and decrement at min',
  template: () => <Counter max="3" min="0" />,
  play: async ({ assert, findByAttribute, fireEvent }) => {
    const increment = await findByAttribute('p-target', 'increment')
    const decrement = await findByAttribute('p-target', 'decrement')
    let display = await findByAttribute('p-target', 'display')

    // Initial state
    assert({
      given: 'initial render',
      should: 'display 0',
      actual: display?.textContent,
      expected: '0',
    })

    // Try decrement at min - should have no effect (blocked)
    decrement && (await fireEvent(decrement, 'click'))
    display = await findByAttribute('p-target', 'display')
    assert({
      given: 'decrement clicked at min (0)',
      should: 'still display 0 (blocked by bThread)',
      actual: display?.textContent,
      expected: '0',
    })

    // Increment to max
    increment && (await fireEvent(increment, 'click'))
    increment && (await fireEvent(increment, 'click'))
    increment && (await fireEvent(increment, 'click'))
    display = await findByAttribute('p-target', 'display')
    assert({
      given: 'increment clicked 3 times',
      should: 'display 3 (max)',
      actual: display?.textContent,
      expected: '3',
    })

    // Try increment at max - should have no effect (blocked)
    increment && (await fireEvent(increment, 'click'))
    display = await findByAttribute('p-target', 'display')
    assert({
      given: 'increment clicked at max (3)',
      should: 'still display 3 (blocked by bThread)',
      actual: display?.textContent,
      expected: '3',
    })
  },
})

export const counterAccessibility = story({
  intent: 'Create an accessible counter with aria-live for screen readers',
  template: () => <Counter max="5" min="-5" />,
  play: async ({ accessibilityCheck, findByAttribute, assert }) => {
    await accessibilityCheck({})

    // Verify aria-live attribute
    const display = await findByAttribute('p-target', 'display')
    assert({
      given: 'counter display',
      should: 'have aria-live polite for screen reader announcements',
      actual: display?.getAttribute('aria-live'),
      expected: 'polite',
    })
  },
})
