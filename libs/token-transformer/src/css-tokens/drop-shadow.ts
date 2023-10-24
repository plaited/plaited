import { DropShadowValue, DropShadowToken, DesignTokenGroup, AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getColor, getRule } from '../utils.js'

const dropShadowCallback = (allTokens: DesignTokenGroup) => ($value: Exclude<DropShadowValue, AliasValue>) => {
  const { offsetX, offsetY, blur, color } = $value
  const value: (string |number)[]= [ offsetX, offsetY, blur ]
  if(hasAlias(color)) {
    value.push(resolveCSSVar(color, allTokens))
  } else {
    value.push(getColor(color))
  }
  return value.filter(Boolean).join(' ')
}

export const dropShadow: Formatter<DropShadowToken> = (token, {
  tokenPath,
  allTokens,
  colorSchemes,
  containerQueries,
  mediaQueries,
}) => {
  const cb = dropShadowCallback(allTokens)
  if(isStaticToken<DropShadowToken, DropShadowValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({ prop, value: cb($value) })
  }
  const toRet: string[] = []
  if(isContextualToken<DropShadowToken, DropShadowValue>(token)) {
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
        toRet.push(getRule({ prop, value: cb(contextValue) }))
      }
    }
  }
  return toRet.join('\n')
}
