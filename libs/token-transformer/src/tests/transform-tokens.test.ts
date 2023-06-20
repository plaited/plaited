import { test, expect } from 'bun:test'
import beautify from 'beautify'
import { transformTsTokens } from '../transform-ts-tokens.js'
import { transformCssTokens } from '../transform-css-tokens.js'
import { tokens } from './sample-tokens.js'
import { defaultTSFormatters, defaultCSSFormatters } from '../index.js'



test('transform-ts-tokens', () => {
  const content = transformTsTokens({
    tokens,
    baseFontSize: 20,
    formatters: defaultTSFormatters,
  })
  expect(content).toMatchSnapshot()
})

test('transform-css-tokens', () => {
  const content = transformCssTokens({
    tokens,
    baseFontSize: 20,
    formatters: defaultCSSFormatters,
  })
  expect(beautify(content, { format: 'css' })).toMatchSnapshot()
})
