import type { StoryObj } from 'plaited/testing'

export const basicStory: StoryObj = {
  description: 'A simple story without interactions',
  args: { title: 'Hello' },
  template: ({ title }: { title: string }) => <div>{title}</div>,
}
