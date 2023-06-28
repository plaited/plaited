import { Meta, Story } from '../../../../types.js'
import { PlaitedElement } from 'plaited'

const template: PlaitedElement = ({ children }) => (
  <label>some input: {children}</label>
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
      data-testid='target'
      value='default value'
    />,
  },
  async play(page, expect) {
    const el = await page.getByTestId('target')
    const actual = await el.inputValue()
    expect(actual).toBe('default value')
  },
}

export const regularStory: Story = {
  description: 'nested mock description',
  attrs: {
    children: 'nope',
  },
}
