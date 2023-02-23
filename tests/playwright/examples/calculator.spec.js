/** GENERATED TEST FILE DO NOT EDIT **/
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { Calculator} from './../.stories/calculator.stories.js'

test.describe('examples/calculator(light)', () => {
  test.use({ colorScheme: 'light' })
  test('Calculator', async ({ page }) => {
    await page.goto('./examples-calculator--calculator')
    const results = await new AxeBuilder({ page }).options({}).include('plaited-workshop-fixture').analyze()
    expect(results.violations).toHaveLength(0)
    const locator = page.locator('plaited-workshop-fixture')
    expect(locator).toMatchSnapshot('examples-calculator--calculator.png')
    if (Calculator.test) {
      await Calculator?.test({locator, expect, id: 'examples-calculator--calculator'})
    }
  })
})
test.describe('examples/calculator(dark)', () => {
  test.use({ colorScheme: 'dark' })
  test('Calculator', async ({ page }) => {
    await page.goto('./examples-calculator--calculator')
    const results = await new AxeBuilder({ page }).options({}).include('plaited-workshop-fixture').analyze()
    expect(results.violations).toHaveLength(0)
    const locator = page.locator('plaited-workshop-fixture')
    expect(locator).toMatchSnapshot('examples-calculator--calculator.png')
    if (Calculator.test) {
      await Calculator?.test({locator, expect, id: 'examples-calculator--calculator'})
    }
  })
})
/** GENERATED TEST FILE DO NOT EDIT **/