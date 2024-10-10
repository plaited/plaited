import type { DesignToken, DesignTokenGroup, Contexts } from '../token.types.js'

export type Formatter<T extends DesignToken = DesignToken> = (
  token: T,
  details: {
    tokenPath: string[]
    allTokens: DesignTokenGroup
    contexts: Contexts
  },
) => string

export type GetFormatters = <T extends DesignTokenGroup = DesignTokenGroup, F extends DesignToken = DesignToken>(
  token: F,
  details: {
    tokenPath: string[]
    allTokens: T
    contexts: Contexts
  },
) => string
