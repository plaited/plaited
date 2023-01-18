import test from 'ava'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { transformTsTokens } from '../transformers/transform-ts-tokens.js'
import { tokens } from '../../__mocks__/tokens.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDirectory = path.resolve(__dirname, './__tmp__/')

test.after(async t => {
  await fs.rm(`${outputDirectory}/tokens.ts`)
})

test('transformTsTokens()',  async t => {
  await transformTsTokens({ tokens, outputDirectory, baseFontSize:  20 })
  const content = await fs.readFile(`${outputDirectory}/tokens.ts`, { encoding: 'utf8' })
  t.snapshot(content)
})
