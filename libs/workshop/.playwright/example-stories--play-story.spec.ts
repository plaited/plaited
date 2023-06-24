import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { playStory } from '../src/tests/__mocks__/get-story-valid/example.stories.js'
 
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000/example-stories--play-story')
});
test('Accessibility check Example/Stories: playStory story', async ({ page }) => {
  //@ts-ignore: {@link  https://github.com/dequelabs/axe-core-npm/issues/601}
  const results = await new AxeBuilder.default({ page }).options({}).include('#root').analyze();
  expect(results.violations).toHaveLength(0);
})
test('Renders Example/Stories: playStory story', async ({ page }) => {
  expect(await page.screenshot()).toMatchSnapshot('example-stories--play-story.png');
});
test('Interaction Example/Stories: playStory story', async (testArgs, testInfo) => {
    playStory.play && await playStory.play(expect, testArgs, testInfo)
});