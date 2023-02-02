import { describe, it, assertSnapshot, resolve } from '../../deps.ts'
import { transformTsTokens } from '../transform-ts-tokens.ts'
import { tokens } from './sample-tokens.ts'
import { tsTokens } from '../ts-tokens/mod.ts'

const __dirname = new URL('.', import.meta.url).pathname
const outputDirectory = resolve(__dirname, './__tmp__/')

describe('TS tokens',() => {
  it('transform', async (t) => {
    await transformTsTokens({ tokens, outputDirectory, baseFontSize: 20, formatters: tsTokens })
    const content = await Deno.readTextFile(`${outputDirectory}/tokens.ts`)
    assertSnapshot(t, content)
  })
})
