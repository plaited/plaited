import { PrimitiveLikeTokens, PrimitiveLikeValues } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule } from '../utils.js'

export const defaultFormat: Formatter<PrimitiveLikeTokens> = (
  token,
  { allTokens, tokenPath, baseFontSize: _, ...contexts },
) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<PrimitiveLikeTokens, PrimitiveLikeValues>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: Array.isArray($value) ? $value.join(' ') : $value })
  }
  const toRet: string[] = []
  if (isContextualToken<PrimitiveLikeTokens, PrimitiveLikeValues>(token)) {
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
        toRet.push(
          getRule({
            prop,
            value: Array.isArray(contextValue) ? contextValue.join(' ') : contextValue,
            context,
            ...contexts,
          }),
        )
      }
    }
  }
  return toRet.join('\n')
}
