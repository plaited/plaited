import { createFragment } from '@plaited/storybook-utils'
import { StoryObj, Meta } from '@plaited/storybook'
import { assert, findByText, findByAttribute } from '@plaited/storybook-rite'
import { Header } from './header.js'

const meta: Meta<typeof Header> = {
  title: 'Example/Header',
  component: Header,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/preact/writing-docs/autodocs
  tags: ['autodocs'],
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/preact/configure/story-layout
    layout: 'fullscreen',
    actions: {
      handles: [`onLogin`, `onLogout`, `onCreateAccount`],
    },
  },
  argTypes: {
    onLogin: { action: 'onLogin' },
    onLogout: { action: 'onLogout' },
    onCreateAccount: { action: 'onCreateAccount' },
  },
}

export default meta
type Story = StoryObj<typeof Header>

export const LoggedIn: Story = {
  render({ user }, extra) {
    const frag = createFragment(<Header user={user?.name} />)
    return frag
  },
  play: async ({ canvasElement }) => {
    const button = await findByText<HTMLButtonElement>('Log out', canvasElement)
    assert({
      given: 'button rendered',
      should: 'should be in shadow dom',
      actual: button?.tagName,
      expected: 'BUTTON',
    })
    assert({
      given: 'button rendered',
      should: 'should have correct content',
      actual: button?.value,
      expected: 'onLogout',
    })
  },
  args: {
    user: {
      name: 'Jane Doe',
    },
  },
}

export const LoggedOut: Story = {
  play: async ({ canvasElement }) => {
    const bar = await findByAttribute('data-target', 'button-bar', canvasElement)
    assert({
      given: 'Logged out mode',
      should: 'Button bar should have two children',
      actual: bar.childElementCount,
      expected: 2,
    })
  },
}
