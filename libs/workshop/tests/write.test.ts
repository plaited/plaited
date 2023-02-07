import {
  // afterEach,
  assert,
  // assertSnapshot,
  describe,
  it,
  resolve,
} from '../../test-deps.ts'
import { write } from '../write/mod.ts'
import { defaultStoryHandlers } from '../default-story-handlers.ts'

const __dirname = new URL('.', import.meta.url).pathname
const assets = resolve(__dirname, './__mocks__/assets')
const root = resolve(__dirname, './__mocks__/root')
const playwright = resolve(__dirname, './__tmp__/specs')

describe('Write', () => {
  it('', async () => {
    await write({
      assets,
      colorScheme: false,
      exts: {
        island: '.island.ts',
        story: '.stories.ts',
      },
      port: 3000,
      project: 'test',
      storyHandlers: defaultStoryHandlers,
      playwright,
      root,
    })
    assert(true)
  })
})
