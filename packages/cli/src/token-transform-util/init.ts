import { transformCssTokens } from './transform-css-tokens.js'
import { transformJsRaw } from './transform-js-raw.js'
import { transformJsTokens } from './transform-js-tokens.js'
import { importJson } from '../import-json.js'
import { DesignTokenGroup } from '../types.js'

export const init = async ({
  tokensPath,
  outputDirectory,
  prefix ='',
}: {
  tokensPath: string
  outputDirectory: string
  prefix?: string
}) => {
  const tokens = await importJson<DesignTokenGroup>(tokensPath)
  await transformCssTokens({ tokens, outputDirectory, prefix })
  await transformJsTokens({ tokens, outputDirectory, prefix })
  await transformJsRaw({ tokens, outputDirectory, prefix })
}


