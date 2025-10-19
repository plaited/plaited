import { bElement } from 'plaited'
import type { StoryObj } from 'plaited/testing'

// Basic StoryObj export
export const basicStory: StoryObj = {
  description: 'A basic story object',
  args: { title: 'Test' },
  template: () => <div>Basic Story</div>,
}

// StoryObj with play function (interaction story)
export const interactionStory: StoryObj = {
  description: 'Story with interactions',
  play: async ({ assert, findByText }) => {
    const element = await findByText('Click me')
    assert({
      given: 'element rendered',
      should: 'exist',
      actual: element !== undefined,
      expected: true,
    })
  },
  template: () => <button>Click me</button>,
}

// StoryObj without play function (snapshot story)
export const snapshotStory: StoryObj = {
  description: 'Visual snapshot story',
  args: { variant: 'primary' },
  parameters: {
    timeout: 10000,
  },
  template: () => <div>Snapshot content</div>,
}

// StoryObj with generic type parameter
export const typedStory: StoryObj<{ count: number }> = {
  description: 'Story with typed args',
  args: { count: 5 },
  template: ({ count }) => <span>Count: {count}</span>,
}

// Default export as StoryObj
const defaultStory: StoryObj = {
  description: 'Default story export',
  template: () => <p>Default</p>,
}

export default defaultStory

// Component that is not a story
export const NotAStory = bElement({
  tag: 'not-a-story',
  shadowDom: <div>Not a story</div>,
})

// Regular function export
export const helperFunction = () => 'helper'

// Regular object that is not a StoryObj
export const config = {
  title: 'Config',
  value: 42,
}
