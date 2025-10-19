import type { StoryObj } from 'plaited/testing'

export const clickTest: StoryObj = {
  description: 'Story with user interactions',
  play: async ({ assert, findByText, fireEvent }) => {
    const button = await findByText('Click me')
    assert({
      given: 'button rendered',
      should: 'exist',
      actual: button !== undefined,
      expected: true,
    })
    button && (await fireEvent(button, 'click'))
  },
  template: () => <button>Click me</button>,
}
