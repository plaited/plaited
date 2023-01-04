import test from 'ava'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { transformCssTokens } from '../transform-css-tokens.js'
import { tokens } from './__mocks__/tokens.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDirectory = path.resolve(__dirname, '__mocks__')

test.after(async t => {
  await fs.rm(`${outputDirectory}/tokens.css`)
})

test.skip('transformCssTokens()',  async t => {
  await transformCssTokens({ tokens, outputDirectory, prefix:  'plaited' })
  const content = await fs.readFile(`${outputDirectory}/tokens.css`, { encoding: 'utf8' })
  t.snapshot(content)
})
