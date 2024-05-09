import { Formatter, DefaultToken, AngleToken, AmountToken, SizeToken } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, resolveCSSVar, hasCommaSeparatedValue } from '../css-utils.js'

export const defaultFormatter: Formatter<DefaultToken | AngleToken | AmountToken | SizeToken> = (
  token,
  { allTokens, tokenPath, contexts },
) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken(token)) {
    const { $value } = token
    return getRule({
      prop,
      value:
        hasAlias($value) ? resolveCSSVar($value, allTokens)
        : Array.isArray($value) ?
          $value
            .map((val) => (hasAlias(val) ? resolveCSSVar(val, allTokens) : val))
            .join(hasCommaSeparatedValue(token) ? ', ' : ' ')
        : $value,
    })
  }
  const toRet: string[] = []
  if (isContextualToken(token)) {
    const {
      $value,
      $extensions: {
        plaited: { context: $context },
      },
    } = token
    for (const id in $value) {
      const contextValue = $value[id]
      const ctx = { type: $context, id }
      if (isValidContext({ ctx, contexts })) {
        toRet.push(
          getRule({
            prop,
            value:
              hasAlias(contextValue) ? resolveCSSVar(contextValue, allTokens)
              : Array.isArray(contextValue) ?
                contextValue
                  .map((val) => (hasAlias(val) ? resolveCSSVar(val, allTokens) : val))
                  .join(hasCommaSeparatedValue(token) ? ', ' : ' ')
              : contextValue,
            ctx,
            contexts,
          }),
        )
      }
    }
  }
  return toRet.join('\n')
}
