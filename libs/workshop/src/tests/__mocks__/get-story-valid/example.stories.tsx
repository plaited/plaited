import { Meta, Story } from '../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = ({ children }) => (
  <div data-test='target'>{children ?? 'Render something'}</div>
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
  async play (expect, { page }){
    const el = await page.locator('[data-test]="target"')
    expect(el.textContent()).toBe('Example play story')
  },
}

export const regularStory: Story = {
  description: 'renders with placeholder',
  attrs: {},
}
