import { ColorToken, ColorValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getColor } from '../utils.js'

export const color: Formatter<ColorToken> = (token, { allTokens, tokenPath, baseFontSize: _, ...contexts }) => {
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
      const context = { type: $context, id }
      if (isValidContext({ context, ...contexts })) {
        toRet.push(getRule({ prop, value: getColor(contextValue), context, ...contexts }))
      }
    }
  }
  return toRet.join('\n')
}
