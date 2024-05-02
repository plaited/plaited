import { camelCase, kebabCase } from '@plaited/utils'
import { Formatter, Contexts, DesignToken, DesignValue } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { resolveTSVar } from '../ts-utils.js'
import { isContextualToken, isValidContext } from '../context-guard.js'

const hasValidContext = (
  token: DesignToken,
  contexts: Contexts,
) => {
  if (isContextualToken<DesignToken, DesignValue>(token)) {
    const {
      $value,
      $extensions: { 'plaited-context': $context },
    } = token
    return Object.keys($value).some((id) => {
      return isValidContext({ ctx: { type: $context, id }, contexts })
    })
  }
}

export const defaultFormat: Formatter = (token, { allTokens, tokenPath, baseFontSize: _, contexts }) => {
  const { $value } = token
  const val =
    hasAlias($value) && !hasValidContext(token, contexts) ?
      resolveTSVar($value, allTokens)
    : `'var(--${kebabCase(tokenPath.join(' '))})'`
  return `export const ${camelCase(tokenPath.join(' '))} = ${val}`
}
