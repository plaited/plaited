import { BoardMarker } from './board-marker.js'
import { Meta, StoryObj } from '@plaited/storybook'
// More on how to set up stories at: https://storybook.js.org/docs/preact/writing-stories/introduction
const meta: Meta<typeof BoardMarker> = {
  component: BoardMarker,
  title: 'Example/BoardMarker',
}

export default meta
type Story = StoryObj<typeof BoardMarker>

export const Render: Story = {}
