import { $Context, DesignToken, StaticToken, ContextualToken, BaseToken, DesignValue } from '@plaited/token-types'
import { Queries, ColorSchemes } from './types.js'

export const isValidContext = ({
  context,
  mediaQueries = {},
  containerQueries = {},
  colorSchemes = {},
}: {
  context: { type: $Context; id: string }
  mediaQueries?: Queries
  containerQueries?: Queries
  colorSchemes?: ColorSchemes
}) => {
  const { type, id } = context
  const obj = type === 'color-scheme' ? colorSchemes : type === 'media-query' ? mediaQueries : containerQueries
  if (!Object.hasOwn(obj, id)) {
    const context =
      type === 'color-scheme' ? `colorSchemes` : type === 'media-query' ? `mediaQueries` : `containerQueries`
    console.error(`${id} not found in ${context}`)
    return false
  }
  return true
}

export const isContextualToken = <U extends DesignToken, V extends DesignValue>(
  token: BaseToken<U['$type'], V>,
): token is ContextualToken<U['$type'], V> => {
  if (!token?.$extensions) return false
  const { 'plaited-context': $context } = token.$extensions
  return $context !== undefined
}

export const isStaticToken = <U extends DesignToken, V extends DesignValue>(
  token: BaseToken<U['$type'], V>,
): token is StaticToken<U['$type'], V> => {
  if (!token?.$extensions) return true
  const { 'plaited-context': $context } = token.$extensions
  return $context === undefined
}
