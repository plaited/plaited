import { story } from 'plaited/testing.ts'

// Simple snapshot story for testing
export const additionalSnapshot = story({
  description: 'An additional snapshot story for filtering tests',
  template: () => <div>Additional Snapshot</div>,
})

// Simple interaction story for testing
export const additionalInteraction = story({
  description: 'An additional interaction story for filtering tests',
  template: () => <button type='button'>Additional Button</button>,
  async play({ assert, findByText }) {
    const button = await findByText('Additional Button')
    assert({
      given: 'button rendered',
      should: 'have correct text',
      actual: button?.textContent,
      expected: 'Additional Button',
    })
  },
})
