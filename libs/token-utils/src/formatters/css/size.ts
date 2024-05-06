import { Formatter, SizeToken } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, remSuffix, resolveCSSVar, hasCommaSeparatedValue } from '../css-utils.js'

const cb = ($value: string | number) =>
  typeof $value === 'string' ? $value : remSuffix($value)

export const size: Formatter<SizeToken> = (token, { allTokens, tokenPath, contexts }) => {
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken(token)) {
    const { $value } = token
    return getRule({ prop, value: hasAlias($value) 
      ? resolveCSSVar($value, allTokens)
      : Array.isArray($value)
      ? $value.map(val => hasAlias(val) ? resolveCSSVar(val, allTokens) : cb(val)).join(hasCommaSeparatedValue(token)? ', ' : ' ')
      : cb($value) }
    )
  }
  const toRet: string[] = []
  if (isContextualToken(token)) {
    const {
      $value,
      $extensions: { plaited:  { context: $context } },
    } = token
    for (const id in $value) {
      const contextValue = $value[id]
      const ctx = { type: $context, id }
      if (isValidContext({ ctx, contexts })) {
        toRet.push(
          getRule({
            prop,
            value: hasAlias(contextValue)
              ? resolveCSSVar(contextValue, allTokens)
              : Array.isArray(contextValue)
              ? contextValue.map(val => hasAlias(val) ? resolveCSSVar(val, allTokens) : cb(val)).join(hasCommaSeparatedValue(token) ? ', ' : ' ')
              : cb(contextValue),
            ctx,
            contexts,
          }),
        )
      }
    }
  }
  return toRet.join('\n')
}
