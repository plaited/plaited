import { createFragment } from '../../utils/dist/index.js'
import { StoryObj, Meta } from '@plaited/storybook'
import { withActions } from '@storybook/addon-actions/decorator'
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
  decorators: [withActions],
}

export default meta
type Story = StoryObj<typeof Header>

export const LoggedIn: Story = {
  render({ user }: { user: { name: string } }) {
    const frag = createFragment(<Header.template user={user?.name} />)
    return frag
  },
  args: {
    user: {
      name: 'Jane Doe',
    },
  },
}

export const LoggedOut = {}
