import { transformCssTokens } from './transform-css-tokens.ts'
import { transformTsTokens } from './transform-ts-tokens.ts'
import { DesignTokenGroup } from '../token-types.ts'

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
