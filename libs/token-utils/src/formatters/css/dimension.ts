import { Formatter, DimensionLikeTokens, DimensionLikeValues } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getRem, resolveCSSVar} from '../css-utils.js'

export const dimension: Formatter<DimensionLikeTokens> = (
  token,
  { allTokens, tokenPath, baseFontSize, contexts },
) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<DimensionLikeTokens, DimensionLikeValues>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: getRem($value, baseFontSize) })
  }
  const toRet: string[] = []
  if (isContextualToken<DimensionLikeTokens, DimensionLikeValues>(token)) {
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
        toRet.push(getRule({ prop, value: getRem(contextValue, baseFontSize), ctx, contexts }))
      }
    }
  }
  return toRet.join('\n')
}
