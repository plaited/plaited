import { assert } from '../../test-deps.ts'
import { resolve } from '../../deps.ts'
import { bundler } from '../mod.ts'

const __dirname = new URL('.', import.meta.url).pathname
const root = resolve(__dirname, './__mocks__/root')
const registryDir = resolve(__dirname, './__mocks__/assets')
Deno.test('bundler()', async (t) => {
  await t.step('setup', async () => {
    await Deno.mkdir(registryDir, { recursive: true })
  })
  // await t.step('bundle', async () => {
  const build = bundler({
    dev: false,
    entryPoints: [`${root}/test.island.ts`],
  })
  const content = await build()
  await Deno.mkdir(registryDir, { recursive: true })
  if (content && Array.isArray(content)) {
    for (const entry of content) {
      const filePath = `${registryDir}${entry[0]}`
      await Deno.writeFile(filePath, entry[1])
      const fileInfo = await Deno.stat(filePath)
      assert(fileInfo.isFile)
      assert(fileInfo.size > 0)
    }
  }
  // })

  await t.step('teardown', async () => {
    await Deno.remove(`${registryDir}/test.island.js`)
  })
})
