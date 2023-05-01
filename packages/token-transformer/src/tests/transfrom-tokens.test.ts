import { test, expect, afterAll, beforeAll } from 'bun:test'
import beautify from 'beautify'
import { resolve } from 'node:path'
import { readFile, rm, mkdir } from 'node:fs/promises'
import { transformTsTokens } from '../transform-ts-tokens.js'
import { transformCssTokens } from '../transform-css-tokens.js'
import { tokens } from './sample-tokens.js'
import { defaultTSFormatters, defaultCSSFormatters } from '../index.js'

const __dirname = new URL('.', import.meta.url).pathname
const output = resolve(__dirname, './__tmp__/')

beforeAll(async () => {
  await mkdir(output, { recursive: true })
})

afterAll(async() => {
  await rm(output, { recursive: true })
})

test('transform-ts-tokens', async () => {
  await transformTsTokens({
    tokens,
    output,
    baseFontSize: 20,
    formatters: defaultTSFormatters,
  })
  const content = await readFile(`${output}/tokens.ts`, { encoding: 'utf-8' })
  expect(content).toMatchSnapshot()
})

test('transform-css-tokens', async () => {
  await transformCssTokens({
    tokens,
    output,
    baseFontSize: 20,
    formatters: defaultCSSFormatters,
  })
  const content = await readFile(`${output}/tokens.css`, { encoding: 'utf-8' })
  expect(beautify(content, { format: 'css' })).toMatchSnapshot()
})
