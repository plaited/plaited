import { transformCssTokens } from './transform-css-tokens.ts'
import { transformTsTokens } from './transform-ts-tokens.ts'
import { DesignTokenGroup, GetFormatters } from '../token-types.ts'
import { defaultCSSFormatters } from './css-tokens/mod.ts'
import { defaultTSFormatters } from './ts-tokens/mod.ts'
export const tokenTransformer = async <
  T extends DesignTokenGroup = DesignTokenGroup,
>({
  tokens,
  output,
  baseFontSize = 20,
  cssFormatters = defaultCSSFormatters,
  tsFormatters = defaultTSFormatters,
}: {
  tokens: T
  output: string
  baseFontSize?: number
  cssFormatters?: GetFormatters
  tsFormatters?: GetFormatters
}) => {
  await transformCssTokens({
    tokens,
    output,
    baseFontSize,
    formatters: cssFormatters,
  })
  await transformTsTokens({
    tokens,
    output,
    baseFontSize,
    formatters: tsFormatters,
  })
}
