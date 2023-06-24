import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
 
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000/example-nested-stories--regular-story')
});
test('Accessibility check Example/NestedStories: regularStory story', async ({ page }) => {
  //@ts-ignore: {@link  https://github.com/dequelabs/axe-core-npm/issues/601}
  const results = await new AxeBuilder.default({ page }).options({}).include('#root').analyze();
  expect(results.violations).toHaveLength(0);
})
test('Renders Example/NestedStories: regularStory story', async ({ page }) => {
  expect(await page.screenshot()).toMatchSnapshot('example-nested-stories--regular-story.png');
});