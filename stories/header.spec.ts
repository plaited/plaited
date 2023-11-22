import { test, expect } from '@playwright/test'
import { toId } from '@plaited/storybook-utils'

test('should render: logged in view', async ({ page }) => {
  await page.goto(`http://localhost:6006/iframe.html?args=&id=${toId('Example/Header', 'Logged In')}`)
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible()
})

test('should render: logged out view', async ({ page }) => {
  await page.goto(`http://localhost:6006/iframe.html?args=&id=${toId('Example/Header', 'Logged Out')}`)
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible()
})
