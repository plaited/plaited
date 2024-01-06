import { XMarker } from './x-marker.js'
import { Meta, StoryObj } from '@plaited/storybook'
// More on how to set up stories at: https://storybook.js.org/docs/preact/writing-stories/introduction
const meta: Meta<typeof XMarker> = {
  title: 'Example/XMarker',
  component: XMarker,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof XMarker>

export const Render: Story = {}