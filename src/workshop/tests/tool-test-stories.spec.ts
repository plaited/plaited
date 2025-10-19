import { test, expect } from 'bun:test'
import { testStories } from '../tool-test-stories.js'

test('testStories: behavioral function exists', () => {
  expect(testStories).toBeDefined()
  expect(typeof testStories).toBe('function')
})

// These tests require complex integration with getTestServer, signals, and Playwright
// They are skipped as they need extensive refactoring to work properly with the behavioral API

test.skip('testStories: runs single passing snapshot story', async () => {
  // TODO: Implement with proper behavioral program lifecycle management
})

test.skip('testStories: runs single interaction story with play function', async () => {
  // TODO: Implement with proper behavioral program lifecycle management
})

test.skip('testStories: runs multiple stories from same file', async () => {
  // TODO: Implement with proper behavioral program lifecycle management
})

test.skip('testStories: runs with color scheme support', async () => {
  // TODO: Implement with proper behavioral program lifecycle management
})

test.skip('testStories: handles test failures correctly', async () => {
  // TODO: Implement with proper behavioral program lifecycle management
})
