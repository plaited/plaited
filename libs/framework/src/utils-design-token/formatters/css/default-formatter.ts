import type {
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
} from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, resolveCSSVar } from '../css-utils.js'

const defaultCallback =
  (allTokens: DesignTokenGroup, isCommaSeparated?: boolean) =>
  ($value: DefaultValue | AngleValue | AmountValue | SizeValue) => {
    return (
      hasAlias($value) ? resolveCSSVar($value, allTokens)
      : Array.isArray($value) ?
        $value.map((val) => (hasAlias(val) ? resolveCSSVar(val, allTokens) : val)).join(isCommaSeparated ? ', ' : ' ')
      : $value
    )
  }

export const defaultFormatter: Formatter<DefaultToken | AngleToken | AmountToken | SizeToken> = (
  token,
  { allTokens, tokenPath, contexts },
) => {
  const isCommaSeparated = Boolean(token?.$extensions?.plaited?.commaSeparated)
  const prop = kebabCase(tokenPath.join(' '))
  const cb = defaultCallback(allTokens, isCommaSeparated)
  if (isStaticToken(token)) {
    const { $value } = token
    return getRule({
      prop,
      value: cb($value),
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
            value: cb(contextValue),
            ctx,
            contexts,
          }),
        )
      }
    }
  }
  return toRet.join('\n')
}
