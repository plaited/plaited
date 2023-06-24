import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
 
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000/example-stories--regular-story')
});
test('Accessibility check Example/Stories: regularStory story', async ({ page }) => {
  //@ts-ignore: {@link  https://github.com/dequelabs/axe-core-npm/issues/601}
  const results = await new AxeBuilder.default({ page }).options({}).include('#root').analyze();
  expect(results.violations).toHaveLength(0);
})
test('Renders Example/Stories: regularStory story', async ({ page }) => {
  expect(await page.screenshot()).toMatchSnapshot('example-stories--regular-story.png');
});