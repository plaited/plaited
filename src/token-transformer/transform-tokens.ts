import { transformCssTokens } from './transform-css-tokens.ts'
import { transformTsTokens } from './transform-ts-tokens.ts'
import { DesignTokenGroup } from '../token-types.ts'
import { GetFormatters } from '../token-types.ts'
import { cssTokens } from './css-tokens/mod.ts'
import { tsTokens } from './ts-tokens/mod.ts'
export const transformTokens = async <T extends DesignTokenGroup = DesignTokenGroup>({
  tokens,
  outputDirectory,
  baseFontSize = 20,
  cssFormatters = cssTokens,
  tsFormatters = tsTokens
}: {
  tokens: T
  outputDirectory: string
  baseFontSize?: number
  cssFormatters?: GetFormatters
  tsFormatters?: GetFormatters
}) => {
  await transformCssTokens({ tokens, outputDirectory, baseFontSize, formatters: cssFormatters })
  await transformTsTokens({ tokens, outputDirectory, baseFontSize, formatters: tsFormatters })
}