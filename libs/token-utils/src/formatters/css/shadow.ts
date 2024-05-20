import { Formatter, ShadowToken, ShadowValue, DesignTokenGroup } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, resolveCSSVar } from '../css-utils.js'

const formatShadowValue = (val: string, isDropShadow?: boolean) => (isDropShadow ? `drop-shadow(${val})` : val)

const shadowCallback = (allTokens: DesignTokenGroup) => ($value: ShadowValue, isDropShadow?: boolean) => {
  if (hasAlias($value)) return formatShadowValue(resolveCSSVar($value, allTokens), isDropShadow)
  const arr = Array.isArray($value) ? $value : [$value]
  return arr
    .map(({ inset, lengths, color }) => {
      return formatShadowValue(
        [
          !isDropShadow && inset,
          ...lengths.map((l) => (hasAlias(l) ? resolveCSSVar(l, allTokens) : l)),
          hasAlias(color) ? resolveCSSVar(color, allTokens) : color,
        ].join(' '),
        isDropShadow,
      )
    })
    .join(isDropShadow ? ' ' : ', ')
}

export const shadow: Formatter<ShadowToken> = (token, { allTokens, tokenPath, contexts }) => {
  const { $extensions } = token
  const isDropShadow = Boolean($extensions?.plaited?.dropShadow)
  const cb = shadowCallback(allTokens)
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken(token)) {
    const { $value } = token
    return getRule({
      prop,
      value: cb($value, isDropShadow),
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
            value: cb(contextValue, isDropShadow),
            ctx,
            contexts,
          }),
        )
      }
    }
  }
  return toRet.join('\n')
}
