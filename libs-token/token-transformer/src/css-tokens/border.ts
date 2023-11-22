import { AliasValue, BorderToken, BorderValue, DesignTokenGroup } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { getRem, getRule, getColor } from '../utils.js'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'

const borderCallback =
  (allTokens: DesignTokenGroup, baseFontSize: number) => ($value: Exclude<BorderValue, AliasValue>) => {
    const { color, width, style } = $value
    const _color = hasAlias(color) ? resolveCSSVar(color, allTokens) : getColor(color)
    const _width = typeof width === 'number' ? getRem(width, baseFontSize) : resolveCSSVar(`${width}`, allTokens)
    return `${_width} ${style} ${_color}`
  }

export const border: Formatter<BorderToken> = (token, { tokenPath, allTokens, baseFontSize, ...contexts }) => {
  const cb = borderCallback(allTokens, baseFontSize)
  if (isStaticToken<BorderToken, BorderValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({ prop, value: cb($value) })
  }
  const toRet: string[] = []
  if (isContextualToken<BorderToken, BorderValue>(token)) {
    const {
      $value,
      $extensions: { 'plaited-context': $context },
    } = token
    for (const id in $value) {
      const prop = kebabCase(tokenPath.join(' '))
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
