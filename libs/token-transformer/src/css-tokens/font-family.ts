import { FontFamilyValue, FontFamilyToken, AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule } from '../utils.js'

const fontFamilyCallback = ($value: Exclude<FontFamilyValue, AliasValue>) =>
  Array.isArray($value)
    ? $value.map((font) => (/\s/g.test(font) ? `"${font}"` : font)).join(',')
    : /\s/g.test($value)
    ? `"${$value}"`
    : $value

export const fontFamily: Formatter<FontFamilyToken> = (
  token,
  { allTokens, tokenPath, baseFontSize: _, ...contexts },
) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<FontFamilyToken, FontFamilyValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: fontFamilyCallback($value) })
  }
  const toRet: string[] = []
  if (isContextualToken<FontFamilyToken, FontFamilyValue>(token)) {
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
        toRet.push(getRule({ prop, value: fontFamilyCallback(contextValue), context, ...contexts }))
      }
    }
  }
  return toRet.join('\n')
}
