import type { StoryObj } from 'plaited/testing'

export const firstStory: StoryObj = {
  description: 'First story in file',
  template: () => <div>First</div>,
}

export const secondStory: StoryObj = {
  description: 'Second story with play',
  play: async ({ assert, wait }) => {
    await wait(100)
    assert({
      given: 'wait completed',
      should: 'pass',
      actual: true,
      expected: true,
    })
  },
  template: () => <span>Second</span>,
}

export const thirdStory: StoryObj = {
  description: 'Third story with args',
  args: { count: 3 },
  template: ({ count = 0 }) => <p>Count: {count}</p>,
}
