import { Button } from './button.js'
import type { StoryObj, Meta, Args } from 'plaited/assert'

const meta: Meta<Args<typeof Button>> = {
  template: Button,
}

export default meta
type Story = StoryObj<Args<typeof Button>>

export const Primary: Story = {
  args: {
    'p-target': 'button',
    primary: true,
    label: 'Primary Button',
  },
}

export const Secondary: Story = {
  args: {
    'p-target': 'button',
    label: 'Secondary Button',
  },
}

export const Large: Story = {
  args: {
    'p-target': 'button',
    size: 'large',
    label: 'Large Button',
  },
}

export const Small: Story = {
  play: async ({ assert, findByAttribute, match }) => {
    const button = await findByAttribute<HTMLButtonElement>('type', 'button')
    const expected = 'Small Button'
    const contains = match(button?.innerHTML ?? '')
    assert({
      given: 'label arg passed to story',
      should: 'render with label content',
      actual: contains(expected),
      expected,
    })
  },
  args: {
    'p-target': 'button',
    size: 'small',
    label: 'Small Button',
  },
}
