import { DesignTokenGroup, DesignToken } from '@plaited/token-types'

export type Queries = {
  [key: string]: string
}

export type ColorSchemes = {
  light?: 'light'
  dark?: 'dark'
}

export type FormatList = (args: {
  tokens: DesignTokenGroup
  allTokens: DesignTokenGroup
  tokenPath?: string[]
  formatters: GetFormatters
  baseFontSize: number
  mediaQueries?: Queries
  containerQueries?: Queries
  colorSchemes?: ColorSchemes
}) => string

export type FormatToken<T> = (args: {
  $value: T
  tokenPath: string[]
  allTokens: DesignTokenGroup
  baseFontSize: number
  mediaQueries?: Queries
  containerQueries?: Queries
  colorSchemes?: ColorSchemes
}) => string

export type Formatter<T extends DesignToken = DesignToken> = (
  token: T,
  details: {
    tokenPath: string[]
    allTokens: DesignTokenGroup
    baseFontSize: number
    mediaQueries?: Queries
    containerQueries?: Queries
    colorSchemes?: ColorSchemes
  },
) => string

export type GetFormatters = <T extends DesignTokenGroup = DesignTokenGroup, F extends DesignToken = DesignToken>(
  token: F,
  details: {
    tokenPath: string[]
    allTokens: T
    baseFontSize: number
    mediaQueries?: Queries
    containerQueries?: Queries
    colorSchemes?: ColorSchemes
  },
) => string

export type TransformerParams = {
  /** an object of the type {@link DesignTokenGroup} */
  tokens: DesignTokenGroup
  /** used for rem calculation default 20 */
  baseFontSize?: number
  /** extend token formatters by passing in custom formatter */
  formatters?: GetFormatters
  /** named media queries */
  mediaQueries?: Queries
  /** container queries */
  containerQueries?: Queries
  /** color schemes */
  colorSchemes?: ColorSchemes
}
