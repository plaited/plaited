import { Formatter, ColorToken, ColorValue } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getColor, resolveCSSVar } from '../css-utils.js'

export const color: Formatter<ColorToken> = (token, { allTokens, tokenPath, baseFontSize: _, contexts }) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<ColorToken, ColorValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: getColor($value) })
  }
  const toRet: string[] = []
  if (isContextualToken<ColorToken, ColorValue>(token)) {
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
        toRet.push(getRule({ prop, value: getColor(contextValue), ctx, contexts }))
      }
    }
  }
  return toRet.join('\n')
}
