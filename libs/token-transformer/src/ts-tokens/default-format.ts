import { Formatter } from '../types.js'
import { camelCase, kebabCase } from '@plaited/utils'
import { hasAlias, resolveTSVar } from '../resolve.js'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { DesignToken, DesignValue } from '@plaited/token-types'

export const defaultFormat: Formatter = (token, {
  tokenPath,
  allTokens,
  mediaQueries,
  colorSchemes,
  containerQueries,
}) => {
  if(isStaticToken<DesignToken, DesignValue>(token)) {
    const { $value } = token
    const val = hasAlias($value)
      ? resolveTSVar($value, allTokens)
      : `'var(--${kebabCase(tokenPath.join(' '))})'`
    return `export const ${camelCase(tokenPath.join(' '))} = ${val}`
  }
  if(isContextualToken<DesignToken, DesignValue>(token)) {
    const { $value, $context } = token
    const toRet: string[] = []
    for(const id in $value) {
      if(isValidContext({ context: { type: $context, id }, colorSchemes, mediaQueries, containerQueries })) {
        const contextPath = [ ...tokenPath, id ]
        toRet.push(`export const ${camelCase(contextPath.join(' '))} = 'var(--${kebabCase(contextPath.join(' '))})'`)
      }
    }
    return toRet.join('\n')
  } 
}
