import { Meta, Story } from '../../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = () => <div></div>

const meta: Meta = {
  title: 'Example/NestedStories',
  description: 'nested meta',
  template,
}

export default meta


export const aStory: Story = {
  description: 'nested mock description',
  attrs: {},
}

export const bStory: Story = {
  description: 'nested mock description',
  attrs: {},
}
