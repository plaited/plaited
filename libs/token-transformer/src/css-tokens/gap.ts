import { GapValue, GapToken, AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getRem } from '../utils.js'

const gapCallback = (baseFontSize: number) => 
  ($value: Exclude<GapValue, AliasValue>) => 
    typeof $value === 'string' 
      ? $value
      : getRem($value, baseFontSize)

export const gap: Formatter<GapToken> = (token, {
  tokenPath,
  baseFontSize,
  allTokens,
  colorSchemes,
  mediaQueries,
  containerQueries,
}) => {
  const cb = gapCallback(baseFontSize)
  if(isStaticToken<GapToken, GapValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({ prop, value: cb($value) })
  }
  const toRet: string[] = []
  if(isContextualToken<GapToken, GapValue>(token)) {
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
        toRet.push(getRule({
          prop,
          value: cb(contextValue), 
        }))
      }
    }
  }
  return toRet.join('\n')
}
