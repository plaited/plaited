import { test, expect } from '@playwright/test'
import { toId } from '@plaited/storybook-utils'
import meta from './button.stories.js'

test('should render: primary', async ({ page }) => {
  await page.goto(`http://localhost:6006/iframe.html?args=&id=${toId(meta.title, 'primary')}`)
  const element = await page.getByTestId('button')
  expect(element).toBeTruthy()
  const text = await element.innerText()
  console.log(text)
  expect(text).toBe('Primary Button')
})

test('should render: secondary', async ({ page }) => {
  await page.goto(`http://localhost:6006/iframe.html?args=&id=${toId(meta.title, 'secondary')}`)
  const element = await page.getByTestId('button')
  expect(element).toBeTruthy()
  const text = await element.innerText()
  console.log(text)
  expect(text).toBe('Secondary Button')
})

test('should render: large', async ({ page }) => {
  await page.goto(`http://localhost:6006/iframe.html?args=&id=${toId(meta.title, 'large')}`)
  const element = await page.getByTestId('button')
  expect(element).toBeTruthy()
  const text = await element.innerText()
  console.log(text)
  expect(text).toBe('Large Button')
})

test('should render: small', async ({ page }) => {
  await page.goto(`http://localhost:6006/iframe.html?args=&id=${toId(meta.title, 'small')}`)
  const element = await page.getByTestId('button')
  expect(element).toBeTruthy()
  const text = await element.innerText()
  console.log(text)
  expect(text).toBe('Small Button')
})
