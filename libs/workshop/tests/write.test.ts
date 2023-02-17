import {
  afterEach,
  assert,
  assertSnapshot,
  beforeEach,
  ConnInfo,
  describe,
  it,
} from '../../test-deps.ts'
import { write } from '../write.ts'
import { getStat } from '../get-stat.ts'
import { router } from '../../server/deps.ts'
import { resolve, toFileUrl } from '../../deps.ts'

const TEST_CONN_INFO: ConnInfo = {
  localAddr: {
    transport: 'tcp',
    hostname: 'test',
    port: 80,
  },
  remoteAddr: {
    transport: 'tcp',
    hostname: 'test',
    port: 80,
  },
}

const __dirname = new URL('.', import.meta.url).pathname
const assets = resolve(__dirname, './__mocks__/assets')
const root = resolve(__dirname, './__mocks__/root')
const playwright = resolve(__dirname, './__tmp__/write')
const importMap = toFileUrl(
  resolve(__dirname, '../../../.vscode/import-map.json'),
)

describe('Write', () => {
  beforeEach(async () => {
    await Deno.mkdir(assets, { recursive: true })
  })
  afterEach(async () => {
    const assetsExist = await getStat(assets)
    !assetsExist && await Deno.mkdir(assets, { recursive: true })
    await Deno.remove(assets, { recursive: true })
    const playwrightExist = await getStat(playwright)
    !playwrightExist && await Deno.mkdir(playwright, { recursive: true })
    await Deno.remove(playwright, { recursive: true })
  })
  it('build', async (t) => {
    const routes = await write({
      assets,
      root,
      importMap,
      playwright,
      dev: true,
      port: 3000,
      exts: {
        story: '.stories.ts',
        island: '.island.ts',
      },
    })
    for (const path in routes) {
      const route = router({
        [path]: routes[path],
      })
      const response = await route(
        new Request(`https://example.com${path}`),
        TEST_CONN_INFO,
      )
      const data = await response.arrayBuffer()
      const decoder = new TextDecoder()
      const text = decoder.decode(data)
      await assertSnapshot(t, text, { name: path })
    }
    const buttonSpec = await Deno.stat(
      `${playwright}/components/example-button.spec.js`,
    )
    const numberFieldSpec = await Deno.stat(
      `${playwright}/components/example-field.spec.js`,
    )
    assert(buttonSpec.isFile)
    assert(buttonSpec.size > 0)
    assert(numberFieldSpec.isFile)
    assert(numberFieldSpec.size > 0)
    const buttonStories = await Deno.stat(
      `${playwright}/.stories/example-button.stories.js`,
    )
    const numberFieldStories = await Deno.stat(
      `${playwright}/.stories/example-field.stories.js`,
    )
    assert(buttonStories.isFile)
    assert(buttonStories.size > 0)
    assert(numberFieldStories.isFile)
    assert(numberFieldStories.size > 0)
    const registry = await Deno.stat(
      `${assets}/.registries/example-field.island.js`,
    )
    assert(registry.isFile)
    assert(registry.size > 0)
  })
})
