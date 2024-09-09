import type { ColorToken, DesignTokenGroup, ColorValue } from '../../token.types.js'
import type { Formatter } from '../formatters.types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '../../../utils.js'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getColor, resolveCSSVar } from '../css-utils.js'

const colorCallback = (allTokens: DesignTokenGroup) => ($value: ColorValue) =>
  hasAlias($value) ? resolveCSSVar($value, allTokens) : getColor($value)

export const color: Formatter<ColorToken> = (token, { allTokens, tokenPath, contexts }) => {
  const cb = colorCallback(allTokens)
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken(token)) {
    const { $value } = token
    return getRule({ prop, value: cb($value) })
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
