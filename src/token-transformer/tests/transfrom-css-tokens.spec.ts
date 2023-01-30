import test from 'ava'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import beautify from 'beautify'
import { transformCssTokens } from '../transformers/transform-css-tokens.ts'
import { tokens } from '../../__mocks__/tokens.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDirectory = path.resolve(__dirname, './__tmp__/')

test.after(async t => {
  await fs.rm(`${outputDirectory}/tokens.css`)
})

test('transformCssTokens()',  async t => {
  await transformCssTokens({ tokens, outputDirectory, baseFontSize:  20 })
  const content = await fs.readFile(`${outputDirectory}/tokens.css`, { encoding: 'utf8' })
  t.snapshot(beautify(content,  { format:  'css' }))
})
