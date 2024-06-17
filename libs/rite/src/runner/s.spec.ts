import { test, expect } from '@playwright/test';

const routes = composeStories(stories)

test('has title', async ({ story, page }) => {
  await story.goto(routes.example);
  ecpect(page).
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});