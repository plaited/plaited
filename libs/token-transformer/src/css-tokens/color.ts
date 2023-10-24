import {
  ColorToken,
  ColorValue,
} from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getColor } from '../utils.js'


export const color:Formatter<ColorToken> =(token, {
  allTokens,
  tokenPath,
  colorSchemes,
  containerQueries,
  mediaQueries,
}) => {
  if(isStaticToken<ColorToken, ColorValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({ prop, value: getColor($value)  })
  }
  const toRet: string[] = []
  if(isContextualToken<ColorToken, ColorValue>(token)) {
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
        toRet.push(getRule({ prop, value: getColor(contextValue) }))
      }
    }
  }
  return toRet.join('\n')
}
