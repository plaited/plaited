import type { FunctionTemplate } from 'plaited'
import type { StoryObj } from 'plaited/testing'

// Mix of story and non-story exports
export const firstStory: StoryObj = {
  description: 'First story',
  template: () => <div>First</div>,
}

export const regularComponent: FunctionTemplate = () => <span>Component</span>

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
}

export const notAStory = {
  name: 'Not a story',
  value: 123,
}

// Story without explicit type annotation but with structure
export const implicitStory = {
  description: 'Implicit story structure',
  args: { enabled: true },
  template: ({ enabled }: { enabled: boolean }) => <button disabled={!enabled}>Button</button>,
}

export function utilityFunction() {
  return 'utility'
}

export const thirdStory: StoryObj = {
  description: 'Third story',
  parameters: {
    timeout: 5000,
  },
  template: () => <article>Article</article>,
}