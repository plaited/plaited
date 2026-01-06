import { story } from 'plaited/testing'

// Snapshot story in nested directory
export const nestedSnapshot = story({
  intent: 'A snapshot story in nested directory',
  template: () => <div>Nested Story</div>,
})

// Interaction story in nested directory
export const nestedInteraction = story({
  intent: 'An interaction story in nested directory',
  template: () => <button type='button'>Nested Button</button>,
  async play({ assert, findByText }) {
    const button = await findByText('Nested Button')
    assert({
      given: 'nested story rendered',
      should: 'have button with text',
      actual: button?.textContent,
      expected: 'Nested Button',
    })
  },
})
