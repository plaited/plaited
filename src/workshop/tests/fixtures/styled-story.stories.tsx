import type { StoryObj } from 'plaited/testing'

export const styledStory: StoryObj = {
  description: 'Story with custom styles and parameters',
  args: { color: 'blue' },
  parameters: {
    timeout: 10000,
  },
  template: ({ color = 'black' }) => <div style={{ color }}>Styled content</div>,
}
