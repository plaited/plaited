import { test, expect } from 'bun:test'
import * as stories from './__mock__/test.stories.js'
import { composeStories } from '../compose-stories.js'
import { STORYBOOK_PATH_ROOT } from '../constants.js'

test('composeStories', () => {
  const storyPaths = composeStories(stories)
  expect(storyPaths).toEqual([[`${STORYBOOK_PATH_ROOT}/example-test--story`, { timeout: 5000 }]])
})
