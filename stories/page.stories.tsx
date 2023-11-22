import { StoryObj, Meta } from '@plaited/storybook'
import { assert, findByAttribute, fireEvent } from '@plaited/storybook-rite'

import { Page } from './page.js'

const meta: Meta<typeof Page> = {
  title: 'Example/Page',
  component: Page,
  parameters: {
    // More on how to position stories at: https://storybook.js.org/docs/preact/configure/story-layout
    layout: 'fullscreen',
  },
}

export default meta

type Story = StoryObj<typeof Page>

// More on interaction testing: https://storybook.js.org/docs/preact/writing-tests/interaction-testing

export const LoggedOut: Story = {}

export const LoggedIn: Story = {
  play: async ({ canvasElement }) => {
    const loginButton = await findByAttribute('value', 'onLogin', canvasElement)
    await fireEvent(loginButton, 'click')
    const logoutButton = await findByAttribute('value', 'onLogout', canvasElement)
    assert({
      given: 'the user is logged in',
      should: 'render the logout button',
      actual: logoutButton.textContent,
      expected: 'Log out',
    })
  },
}
