import test from 'ava'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { transformTsTokens } from '../transformers/transform-ts-tokens.ts'
import { tokens } from '../../__mocks__/tokens.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputDirectory = path.resolve(__dirname, './__tmp__/')

test.after(async t => {
  await Deno.remove(`${outputDirectory}/tokens.ts`)
})

test('transformTsTokens()',  async t => {
  await transformTsTokens({ tokens, outputDirectory, baseFontSize:  20 })
  const content = await readFile(`${outputDirectory}/tokens.ts`, { encoding: 'utf8' })
  t.snapshot(content)
})
