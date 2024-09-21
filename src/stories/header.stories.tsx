import { StoryObj, Meta } from '../workshop.js'
import { Header } from './header.js'

const meta: Meta<typeof Header> = {
  template: Header,
}

export default meta
type Story = StoryObj<typeof Header>

export const LoggedIn: Story = {
  play: async ({ findByText, assert }) => {
    const button = await findByText<HTMLButtonElement>('Log out')
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
    user:  'Jane Doe',
  },
}

export const LoggedOut: Story = {
  play: async ({ findByAttribute, assert }) => {
    const bar = await findByAttribute('p-target', 'button-bar')
    assert({
      given: 'Logged out mode',
      should: 'Button bar should have two children',
      actual: bar.childElementCount,
      expected: 2,
    })
  },
}
