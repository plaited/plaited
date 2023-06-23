import { Meta, Story } from '../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = () => <div></div>

const meta: Meta = {
  title: 'Example/DuplicateStories',
  description: 'meta',
  template,
}

export default meta


export const A_Story: Story = {
  description: 'mock description',
  attrs: {},
}

export const a_Story: Story = {
  description: 'mock description',
  attrs: {},
}
