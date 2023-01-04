import { transformCssTokens } from './transform-css-tokens.js'
import { transformJsRaw } from './transform-js-raw.js'
import { transformJsTokens } from './transform-js-tokens.js'
import { importJson } from '../import-json.js'
import { DesignTokenGroup } from '../types.js'

export const init = async ({
  tokensPath,
  outputDirectory,
  baseFontSize = 16,
}: {
  tokensPath: string
  outputDirectory: string
  baseFontSize?: number
}) => {
  const tokens = await importJson<DesignTokenGroup>(tokensPath)
  await transformCssTokens({ tokens, outputDirectory, baseFontSize })
  await transformJsTokens({ tokens, outputDirectory, baseFontSize })
  await transformJsRaw({ tokens, outputDirectory, baseFontSize })
}


