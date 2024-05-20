import {
  Formatter,
  DefaultToken,
  AngleToken,
  AmountToken,
  SizeToken,
  DefaultValue,
  AngleValue,
  AmountValue,
  SizeValue,
  DesignTokenGroup,
  DesignToken,
} from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, resolveCSSVar, hasCommaSeparatedValue } from '../css-utils.js'

const defaultCallback =
  (allTokens: DesignTokenGroup) =>
  ($value: DefaultValue | AngleValue | AmountValue | SizeValue, token: DesignToken) => {
    return (
      hasAlias($value) ? resolveCSSVar($value, allTokens)
      : Array.isArray($value) ?
        $value
          .map((val) => (hasAlias(val) ? resolveCSSVar(val, allTokens) : val))
          .join(hasCommaSeparatedValue(token) ? ', ' : ' ')
      : $value
    )
  }

export const defaultFormatter: Formatter<DefaultToken | AngleToken | AmountToken | SizeToken> = (
  token,
  { allTokens, tokenPath, contexts },
) => {
  const prop = kebabCase(tokenPath.join(' '))
  const cb = defaultCallback(allTokens)
  if (isStaticToken(token)) {
    const { $value } = token
    return getRule({
      prop,
      value: cb($value, token),
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
            value: cb(contextValue, token),
            ctx,
            contexts,
          }),
        )
      }
    }
  }
  return toRet.join('\n')
}
