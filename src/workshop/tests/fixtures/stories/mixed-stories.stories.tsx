import { story } from 'plaited/testing'

// Snapshot story with args and template
export const basicStory = story({
  description: 'A basic snapshot story',
  template: (attrs = { prop: '' }) => <div>Basic {attrs.prop}</div>,
  args: { prop: 'value' },
})

// Interaction story with play function
export const interactionStory = story({
  description: 'An interaction story with play function',
  template: () => <button type='button'>Click me</button>,
  async play({ assert, findByText }) {
    const button = await findByText('Click me')
    assert({
      given: 'button rendered',
      should: 'have text',
      actual: button?.textContent,
      expected: 'Click me',
    })
  },
})

// Snapshot story with template and parameters
export const storyWithParams = story({
  description: 'Story with parameters',
  template: () => <div>Params</div>,
  parameters: {
    timeout: 10000,
  },
})

// Snapshot story with all properties
export const storyWithAllProps = story({
  description: 'Story with all properties',
  template: (attrs = { test: false }) => <div>All props {attrs.test ? 'enabled' : 'disabled'}</div>,
  args: { test: true },
  parameters: {
    timeout: 5000,
  },
})

// Failing interaction story for testing error reporting
export const failingStory = story({
  description: 'A story that intentionally fails',
  template: () => <div>This will fail</div>,
  async play({ assert, findByText }) {
    const element = await findByText('This will fail')
    assert({
      given: 'element rendered',
      should: 'have wrong text',
      actual: element?.textContent,
      expected: 'This is not the text', // Intentionally wrong
    })
  },
})

// Regular function (not a story - should be filtered out)
export const helperFunction = () => {
  return 'helper'
}

// Default export (should be filtered out)
export default {
  title: 'Mixed Stories',
}
