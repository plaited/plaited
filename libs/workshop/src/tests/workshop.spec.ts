import { test, expect } from'@jest/globals'
import { workshop } from '../workshop.js'

test('workshop', async () => {
  await workshop({
    exts: '.stories.tsx',
    srcDir: 'src/tests/__mocks__/get-story-valid',
    testDir: '.playwright',
    reload: false,
  })
})
