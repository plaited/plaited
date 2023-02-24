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
  /** an object of the type {@link DesignTokenGroup} */
  tokens: T
  /** directory we want to write transformed token too */
  output: string
  /** used for rem calculation default 20 */
  baseFontSize?: number
  /** extend the cssFormatters by passing in custom formatter */
  cssFormatters?: GetFormatters
  /** extend the tsFormatters by passing in custom formatter */
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
