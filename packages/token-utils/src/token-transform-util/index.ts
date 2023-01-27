import { transformCssTokens } from './transformers/transform-css-tokens.js'
import { transformTsTokens } from './transformers/transform-ts-tokens.js'
import { DesignTokenGroup } from '../types.js'

export const tokenTransformUtil = async ({
  tokens,
  outputDirectory,
  baseFontSize = 20,
}: {
  tokens: DesignTokenGroup
  outputDirectory: string
  baseFontSize?: number
}) => {
  await transformCssTokens({ tokens, outputDirectory, baseFontSize })
  await transformTsTokens({ tokens, outputDirectory, baseFontSize })
}


