import type {
  DefaultToken,
  AngleToken,
  AmountToken,
  SizeToken,
  DefaultValue,
  AngleValue,
  AmountValue,
  SizeValue,
  DesignTokenGroup,
} from '../../token.types.ts'
import type { Formatter } from '../formatters.types.ts'
import { hasAlias } from '../has-alias.ts'
import { kebabCase } from '../../../utils/case.ts'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.ts'
import { getRule, resolveCSSVar } from '../css-utils.ts'

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
