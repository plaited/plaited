import { Formatter, Queries, ColorSchemes } from '../types.js'
import { camelCase, kebabCase } from '@plaited/utils'
import { hasAlias, resolveTSVar } from '../resolve.js'
import { isContextualToken, isValidContext } from '../context-guard.js'
import { DesignToken, DesignValue } from '@plaited/token-types'

const hasValidContext = (
  token: DesignToken,
  contexts: {
    mediaQueries?: Queries
    containerQueries?: Queries
    colorSchemes?: ColorSchemes
  } = {},
) => {
  if (isContextualToken<DesignToken, DesignValue>(token)) {
    const {
      $value,
      $extensions: { 'plaited-context': $context },
    } = token
    return Object.keys($value).some((id) => {
      const context = { type: $context, id }
      return isValidContext({ context, ...contexts })
    })
  }
}

export const defaultFormat: Formatter = (token, { allTokens, tokenPath, baseFontSize: _, ...contexts }) => {
  const { $value } = token
  const val =
    hasAlias($value) && !hasValidContext(token, contexts)
      ? resolveTSVar($value, allTokens)
      : `'var(--${kebabCase(tokenPath.join(' '))})'`
  return `export const ${camelCase(tokenPath.join(' '))} = ${val}`
}
