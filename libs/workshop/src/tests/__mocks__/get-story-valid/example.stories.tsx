import { Meta, Story } from '../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = () => <div></div>

const meta: Meta = {
  title: 'Example/Stories',
  description: 'meta',
  template,
}

export default meta


export const aStory: Story = {
  description: 'mock description',
  attrs: {},
}

export const bStory: Story = {
  description: 'mock description',
  attrs: {},
}
