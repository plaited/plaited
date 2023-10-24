import { FontFamilyValue, FontFamilyToken, AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule } from '../utils.js'

const fontFamilyCallback = ($value: Exclude<FontFamilyValue, AliasValue>) => Array.isArray($value) 
  ? $value
    .map(font => /\s/g.test(font) ? `"${font}"` : font)
    .join(',')
  : /\s/g.test($value)
  ? `"${$value}"`
  : $value

export const fontFamily: Formatter<FontFamilyToken> = (token, {
  allTokens,
  tokenPath,
  colorSchemes,
  containerQueries,
  mediaQueries,
}) => {
  if(isStaticToken<FontFamilyToken, FontFamilyValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({ prop, value: fontFamilyCallback($value) })
  }
  const toRet: string[] = []
  if(isContextualToken<FontFamilyToken, FontFamilyValue>(token)) {
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
        toRet.push(getRule({ prop, value: fontFamilyCallback(contextValue) }))
      }
    }
  }
  return toRet.join('\n')
}
