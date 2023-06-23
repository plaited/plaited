import { Meta } from '../../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = () => <div></div>

const meta: Meta = {
  title: 'Example/BadStory',
  description: 'meta',
  template,
}

export default meta


export const $a = {
  description: 'mock description',
  attrs: {},
}

export const a_Story = 'mock description'

export const bStory = {
  description: 'mock description',
}
