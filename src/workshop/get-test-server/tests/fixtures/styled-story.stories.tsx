import type { StoryObj } from 'plaited/testing'

export const styledStory: StoryObj = {
  description: 'Story with custom styles and parameters',
  args: { color: 'blue' },
  parameters: {
    timeout: 10000,
  },
  template: ({ color }: { color: string }) => <div style={`color: ${color}`}>Styled content</div>,
}
