import { assertSnapshot } from '../../test-deps.ts'
import { resolve } from '../../deps.ts'
import { transformTsTokens } from '../transform-ts-tokens.ts'
import { tokens } from './sample-tokens.ts'
import { defaultTSFormatters } from '../ts-tokens/mod.ts'

const __dirname = new URL('.', import.meta.url).pathname
const outputDirectory = resolve(__dirname, './__tmp__/')

Deno.test('transform-ts-tokens', async (t) => {
  await transformTsTokens({
    tokens,
    outputDirectory,
    baseFontSize: 20,
    formatters: defaultTSFormatters,
  })
  const content = await Deno.readTextFile(`${outputDirectory}/tokens.ts`)
  assertSnapshot(t, content)
  await Deno.remove(outputDirectory, { recursive: true })
})
