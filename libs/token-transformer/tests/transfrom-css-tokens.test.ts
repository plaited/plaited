import {
  afterEach,
  assertSnapshot,
  beautify,
  describe,
  it,
} from '../../test-deps.ts'
import { resolve } from '../../deps.ts'
import { transformCssTokens } from '../transform-css-tokens.ts'
import { tokens } from './sample-tokens.ts'
import { defaultCSSFormatters } from '../css-tokens/mod.ts'

const __dirname = new URL('.', import.meta.url).pathname
const outputDirectory = resolve(__dirname, './__tmp__/')

describe('CSS tokens', () => {
  afterEach(async () => {
    await Deno.remove(outputDirectory, { recursive: true })
  })
  it('transform', async (t) => {
    await transformCssTokens({
      tokens,
      outputDirectory,
      baseFontSize: 20,
      formatters: defaultCSSFormatters,
    })
    const content = await Deno.readTextFile(`${outputDirectory}/tokens.css`)
    assertSnapshot(t, beautify(content, { format: 'css' }))
  })
})