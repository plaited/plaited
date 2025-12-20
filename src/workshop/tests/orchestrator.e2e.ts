import { expect, test } from '@playwright/test'

test.describe('plaited-orchestrator', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/orchestrator-validation')
  })

  test('should render header with toggle button', async ({ page }) => {
    const header = page.locator('plaited-orchestrator plaited-header')
    await expect(header).toBeVisible()

    const toggleButton = header.locator('button:has-text("Toggle Mask")')
    await expect(toggleButton).toBeVisible()
  })

  test('should toggle mask visibility on button click', async ({ page }) => {
    const orchestrator = page.locator('plaited-orchestrator')
    const toggleButton = orchestrator.locator('button:has-text("Toggle Mask")')
    const mask = orchestrator.locator('plaited-mask')

    // Initially mask should be hidden
    await expect(mask).toHaveCSS('display', 'none')

    // Click toggle button
    await toggleButton.click()

    // Mask should be visible
    await expect(mask).toHaveCSS('display', 'block')

    // Click again to hide
    await toggleButton.click()
    await expect(mask).toHaveCSS('display', 'none')
  })

  test('should update toggle button visual state', async ({ page }) => {
    const toggleButton = page.locator('button:has-text("Toggle Mask")')

    // Initially white background
    await expect(toggleButton).toHaveCSS('background-color', 'rgb(255, 255, 255)')

    // Click to activate
    await toggleButton.click()

    // Should have blue background
    await expect(toggleButton).toHaveCSS('background-color', 'rgb(0, 123, 255)')
  })

  test('should have correct grid layout', async ({ page }) => {
    const orchestrator = page.locator('plaited-orchestrator')

    await expect(orchestrator).toHaveCSS('display', 'grid')
    await expect(orchestrator).toHaveCSS('grid-template-rows', 'auto 1fr')
    await expect(orchestrator).toHaveCSS('grid-template-areas', '"header" "content"')
  })

  test('should overlay mask on fixture with z-index', async ({ page }) => {
    const orchestrator = page.locator('plaited-orchestrator')
    const toggleButton = orchestrator.locator('button:has-text("Toggle Mask")')

    // Enable mask
    await toggleButton.click()

    // Get slots from shadow DOM
    const fixtureSlot = orchestrator.locator('slot[name="fixture"]')
    const maskSlot = orchestrator.locator('slot[name="mask"]')

    // Both should occupy same grid area
    await expect(fixtureSlot).toHaveCSS('grid-area', 'content')
    await expect(maskSlot).toHaveCSS('grid-area', 'content')

    // Verify z-index layering
    await expect(fixtureSlot).toHaveCSS('z-index', '1')
    await expect(maskSlot).toHaveCSS('z-index', '10')
  })
})
