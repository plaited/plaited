import { DropShadowValue, DropShadowToken, DesignTokenGroup, AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getColor, getRule } from '../utils.js'

const dropShadowCallback = (allTokens: DesignTokenGroup) => ($value: Exclude<DropShadowValue, AliasValue>) => {
  const { offsetX, offsetY, blur, color } = $value
  const value: (string | number)[] = [offsetX, offsetY, blur]
  if (hasAlias(color)) {
    value.push(resolveCSSVar(color, allTokens))
  } else {
    value.push(getColor(color))
  }
  return value.filter(Boolean).join(' ')
}

export const dropShadow: Formatter<DropShadowToken> = (
  token,
  { allTokens, tokenPath, baseFontSize: _, ...contexts },
) => {
  const prop = kebabCase(tokenPath.join(' '))
  const cb = dropShadowCallback(allTokens)
  if (isStaticToken<DropShadowToken, DropShadowValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: cb($value) })
  }
  const toRet: string[] = []
  if (isContextualToken<DropShadowToken, DropShadowValue>(token)) {
    const {
      $value,
      $extensions: { 'plaited-context': $context },
    } = token
    for (const id in $value) {
      const contextValue = $value[id]
      if (hasAlias(contextValue)) {
        toRet.push(getRule({ prop, value: resolveCSSVar(contextValue, allTokens) }))
        continue
      }
      const context = { type: $context, id }
      if (isValidContext({ context, ...contexts })) {
        toRet.push(getRule({ prop, value: cb(contextValue), context, ...contexts }))
      }
    }
  }
  return toRet.join('\n')
}
