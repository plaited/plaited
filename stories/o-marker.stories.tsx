import { OMarker } from './o-marker.js'
import { Meta, StoryObj } from '@plaited/storybook'
// More on how to set up stories at: https://storybook.js.org/docs/preact/writing-stories/introduction
const meta: Meta<typeof OMarker> = {
  title: 'Example/OMarker',
  component: OMarker,
}

export default meta
type Story = StoryObj<typeof OMarker>

export const Render: Story = {}
