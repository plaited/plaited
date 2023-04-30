import { assertSnapshot } from '../../dev-deps.ts'
import { resolve } from '../../deps.ts'
import { transformTsTokens } from '../transform-ts-tokens.ts'
import { tokens } from './sample-tokens.ts'
import { defaultTSFormatters } from '../ts-tokens/mod.ts'

const __dirname = new URL('.', import.meta.url).pathname
const output = resolve(__dirname, './__tmp__/')

Deno.test('transform-ts-tokens', async t => {
  await transformTsTokens({
    tokens,
    output,
    baseFontSize: 20,
    formatters: defaultTSFormatters,
  })
  const content = await Deno.readTextFile(`${output}/tokens.ts`)
  assertSnapshot(t, content)
  await Deno.remove(output, { recursive: true })
})
