import {
  PrimitiveLikeTokens,
  PrimitiveLikeValues,
} from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule } from '../utils.js'


export const defaultFormat:Formatter<PrimitiveLikeTokens> =(token, {
  allTokens,
  tokenPath,
  colorSchemes,
  containerQueries,
  mediaQueries,
}) => {
  if(isStaticToken<PrimitiveLikeTokens, PrimitiveLikeValues>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({ prop, value: Array.isArray($value) ? $value.join(' ') : $value })
  }
  const toRet: string[] = []
  if(isContextualToken<PrimitiveLikeTokens, PrimitiveLikeValues>(token)) {
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
        toRet.push(getRule({ prop, value: Array.isArray(contextValue) ? contextValue.join(' ') : contextValue }))
      }
    }
  }
  return toRet.join('\n')
}
