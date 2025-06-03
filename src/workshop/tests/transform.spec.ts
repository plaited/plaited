import { expect, test } from 'bun:test'
import { transform } from '../transform'
test('transform', async () => {
  await transform('src/workshop/tests/eg.tsx')
  expect(true).toBe(true) // Placeholder assertion, replace with actual test logic
})
