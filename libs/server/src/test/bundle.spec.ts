import { test, expect } from 'bun:test'
import { bundle } from '../bundle.js'

test('bundle', async () => {
  const __dirname = import.meta.dir

  const { outputs } = await bundle(__dirname)
  expect(outputs?.length).toBe(3)
})
