import { Formatter, DropShadowValue, DropShadowToken, DesignTokenGroup, AliasValue } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getColor, getRule, resolveCSSVar } from '../css-utils.js'

const dropShadowCallback = (allTokens: DesignTokenGroup) => ($value: Exclude<DropShadowValue, AliasValue>) => {
  const { offsetX, offsetY, blur, color } = $value
  const value: (number | string | undefined)[] = [offsetX, offsetY, blur]
  if (hasAlias(color)) {
    value.push(resolveCSSVar(color, allTokens))
  } else if (color) {
    value.push(getColor(color))
  }
  return value.filter(Boolean).join(' ')
}

export const dropShadow: Formatter<DropShadowToken> = (
  token,
  { allTokens, tokenPath, baseFontSize: _, contexts },
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
      const ctx = { type: $context, id }
      if (isValidContext({ ctx, contexts })) {
        toRet.push(getRule({ prop, value: cb(contextValue), ctx, contexts }))
      }
    }
  }
  return toRet.join('\n')
}
