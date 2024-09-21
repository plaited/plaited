import { StoryObj } from '../workshop.js'
import { Page } from './page.js'

export const LoggedOut: StoryObj = {
  template: Page,
}

export const LoggingIn: StoryObj = {
  template: Page,
  play: async ({ assert, findByAttribute, fireEvent }) => {
    const loginButton = await findByAttribute('value', 'onLogin')
    await fireEvent(loginButton, 'click')
    const logoutButton = await findByAttribute('value', 'onLogout')
    assert({
      given: 'the user is logged in',
      should: 'render the logout button',
      actual: logoutButton.textContent,
      expected: 'Log out',
    })
  },
}
