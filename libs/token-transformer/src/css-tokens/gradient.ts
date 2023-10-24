import { GradientValue, GradientToken, DesignTokenGroup, AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getColor } from '../utils.js'

const colorMapCallback = (allTokens: DesignTokenGroup) => ($value: Exclude<GradientValue, AliasValue>) => {
  const { gradientFunction, angleShapePosition, colorStops } = $value
  const stops = colorStops.map(({ color, position }) =>   hasAlias(color)
    ? [ resolveCSSVar(color, allTokens), position ]
      .filter(Boolean)
      .join(' ')
    : [ getColor(color), position ]
      .filter(Boolean)
      .join(' ')
  )
  return `${gradientFunction}(${[ angleShapePosition, ...stops ].filter(Boolean).join(',')})`
}

export const gradient: Formatter<GradientToken> = (token, {
  tokenPath,
  allTokens,
  mediaQueries,
  containerQueries,
  colorSchemes,
}) => {
  const cb = colorMapCallback(allTokens)
  if(isStaticToken<GradientToken, GradientValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    const prop = kebabCase(tokenPath.join(' '))
    return getRule({
      prop,
      value: cb($value),
    })
  }
  const toRet: string[] = []
  if(isContextualToken<GradientToken, GradientValue>(token)) {
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
