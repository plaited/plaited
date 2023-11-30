import { findByAttribute, match, assert } from '@plaited/storybook-rite'
import { Button } from './button.js'
import { Meta, StoryObj } from '@plaited/storybook'

// More on how to set up stories at: https://storybook.js.org/docs/preact/writing-stories/introduction
const meta: Meta<typeof Button> = {
  title: 'Example/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    backgroundColor: { control: 'color' },
    onClick: { action: 'onClick' },
  },
}

export default meta
type Story = StoryObj<typeof Button>

// More on writing stories with args: https://storybook.js.org/docs/preact/writing-stories/args
export const Primary: Story = {
  args: {
    dataTarget: 'button',
    primary: true,
    label: 'Primary Button',
  },
}

export const Secondary: Story = {
  args: {
    dataTarget: 'button',
    label: 'Secondary Button',
  },
}

export const Large: Story = {
  args: {
    dataTarget: 'button',
    size: 'large',
    label: 'Large Button',
  },
}

export const Small: Story = {
  play: async ({ canvasElement }) => {
    const button = await findByAttribute<HTMLButtonElement>('type', 'button', canvasElement)
    const expected = 'Small Button'
    const contains = match(button.innerHTML)
    assert({
      given: 'label arg passed to story',
      should: 'render with label content',
      actual: contains(expected),
      expected,
    })
  },
  args: {
    dataTarget: 'button',
    size: 'small',
    label: 'Small Button',
  },
}
