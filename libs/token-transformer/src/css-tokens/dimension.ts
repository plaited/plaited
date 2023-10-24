import { DimensionLikeTokens, DimensionLikeValues } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getRem } from '../utils.js'

export const dimension: Formatter<DimensionLikeTokens> = (token, { 
  tokenPath,
  baseFontSize,
  containerQueries,
  colorSchemes,
  mediaQueries,
  allTokens,
}) => {
  if(isStaticToken<DimensionLikeTokens, DimensionLikeValues>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({ prop, value: getRem($value, baseFontSize) })
  }
  const toRet: string[] = []
  if(isContextualToken<DimensionLikeTokens, DimensionLikeValues>(token)) {
    const { $value, $context } = token   
    for(const id in $value) {
      const contextPath = [ ...tokenPath, id ]
      const prop = kebabCase(contextPath.join(' '))
      const contextValue = $value[id]
      if (hasAlias(contextValue)) {
        toRet.push(getRule({ prop, value: resolveCSSVar(contextValue, allTokens) }))
        continue
      }
      if(isValidContext({ context: { type: $context, id }, colorSchemes, mediaQueries, containerQueries })) {
        toRet.push(getRule({ prop, value: getRem(contextValue, baseFontSize) }))
      }
    }
  }
  return toRet.join('\n')
}
