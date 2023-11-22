import { test, expect } from '@playwright/test'
import { toId } from '@plaited/storybook-utils'

test('should render: logged in view', async ({ page }) => {
  await page.goto(`http://localhost:6006/iframe.html?args=&id=${toId('Example/Page', 'Logged Out')}`)
  await expect(page.getByRole('heading', { name: 'Pages in Storybook' })).toBeVisible()
  let button = await page.getByRole('button', { name: 'Log in' })
  await expect(button).toBeVisible()
  button.click()
  button = await page.getByRole('button', { name: 'Log out' })
  await expect(button).toBeVisible()
})
