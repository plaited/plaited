import { Formatter, ColorToken } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getColor, resolveCSSVar } from '../css-utils.js'

export const color: Formatter<ColorToken> = (token, { allTokens, tokenPath, contexts }) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken(token)) {
    const { $value } = token
    return getRule({ prop, value: hasAlias($value) ? resolveCSSVar($value, allTokens) :  getColor($value) })
  }
  const toRet: string[] = []
  if (isContextualToken(token)) {
    const {
      $value,
      $extensions: { plaited: { context: $context } },
    } = token
    for (const id in $value) {
      const contextValue = $value[id]
      const ctx = { type: $context, id }
      if (isValidContext({ ctx, contexts })) {
        toRet.push(getRule({ prop, value: hasAlias(contextValue)
          ? resolveCSSVar(contextValue, allTokens)
          : getColor(contextValue), ctx, contexts }
        ))
      }
    }
  }
  return toRet.join('\n')
}
