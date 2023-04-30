import { assertSnapshot, beautify } from '../../dev-deps.ts'
import { resolve } from '../../deps.ts'
import { transformCssTokens } from '../transform-css-tokens.js'
import { tokens } from './sample-tokens.js'
import { defaultCSSFormatters } from '../css-tokens/mod.js'

const __dirname = new URL('.', import.meta.url).pathname
const output = resolve(__dirname, './__tmp__/')

Deno.test('transform-css-tokens', async t => {
  await transformCssTokens({
    tokens,
    output,
    baseFontSize: 20,
    formatters: defaultCSSFormatters,
  })
  const content = await Deno.readTextFile(`${output}/tokens.css`)
  assertSnapshot(t, beautify(content, { format: 'css' }))
  await Deno.remove(output, { recursive: true })
})
