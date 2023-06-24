import { Meta, Story } from '../../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = ({ children }) => (
  <label data-test='target'>some input: {children}</label>
)

const meta: Meta = {
  title: 'Example/NestedStories',
  description: 'nested meta',
  template,
}

export default meta


export const playStory: Story = {
  description: 'nested mock description',
  attrs: {
    children: <input type='text'
      value='default value'
    />,
  },
  async play(expect, { page }) {
    const el = await page.locator('input')
    expect(el.inputValue()).toBe('default value')
  },
}

export const regularStory: Story = {
  description: 'nested mock description',
  attrs: {
    children: 'nope',
  },
}
