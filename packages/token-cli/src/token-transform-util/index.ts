import { transformCssTokens } from './transformers/transform-css-tokens.js'
import { transformTsTokens } from './transformers/transform-ts-tokens.js'
import { importJson } from '../token-schema-util/import-json.js'
import { DesignTokenGroup } from './types.js'

export const tokenTransformUtil = async ({
  tokensPath,
  outputDirectory,
  baseFontSize = 20,
}: {
  tokensPath: string
  outputDirectory: string
  baseFontSize?: number
}) => {
  const tokens = await importJson<DesignTokenGroup>(tokensPath)
  await transformCssTokens({ tokens, outputDirectory, baseFontSize })
  await transformTsTokens({ tokens, outputDirectory, baseFontSize })
}


