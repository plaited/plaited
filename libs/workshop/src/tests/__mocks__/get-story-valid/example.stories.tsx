import { Meta, Story } from '../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = ({ children }) => (
  <div data-testid='target'>{children ?? 'Render something'}</div>
)

const meta: Meta = {
  title: 'Example/Stories',
  description: 'meta',
  template,
}

export default meta


export const playStory: Story = {
  description: 'replaces placeholder text',
  attrs: {
    children: 'Example story',
  },
  async play (page, expect){
    const el = await page.getByTestId('target')
    const actual = await el.textContent()
    expect(actual).toBe('Example story')
  },
}

export const regularStory: Story = {
  description: 'renders with placeholder',
  attrs: {},
}
