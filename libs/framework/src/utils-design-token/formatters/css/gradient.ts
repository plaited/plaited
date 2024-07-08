import type { Formatter, GradientValue, GradientToken, DesignTokenGroup } from '../../types.js'
import { hasAlias } from '../has-alias.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getColor, resolveCSSVar } from '../css-utils.js'

const colorMapCallback = (allTokens: DesignTokenGroup) => ($value: GradientValue) => {
  if (hasAlias($value)) return resolveCSSVar($value, allTokens)
  const { gradientFunction, angleShapePosition, colorStops } = $value
  const stops = colorStops.map(({ color, position }) =>
    hasAlias(color) ? [resolveCSSVar(color, allTokens), position].filter(Boolean).join(' ')
    : color ? [getColor(color), position].filter(Boolean).join(' ')
    : [color, position].filter(Boolean).join(' '),
  )
  return `${gradientFunction}(${[angleShapePosition, ...stops].filter(Boolean).join(',')})`
}

export const gradient: Formatter<GradientToken> = (token, { allTokens, tokenPath, contexts }) => {
  const cb = colorMapCallback(allTokens)
  const prop = kebabCase(tokenPath.join(' '))
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
