import { AliasValue, Formatter, GradientValue } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '../../deps.js'

export const gradient: Formatter<GradientValue> = (
  { tokenPath, $value, allTokens },
) => {
  if (hasAlias($value)) return ''
  const { gradientFunction, angleShapePosition, colorStops } =
    $value as Exclude<GradientValue, AliasValue>
  const stops = colorStops.map(({ color, position }) => {
    const _color: string | undefined = color && hasAlias(color)
      ? resolveCSSVar(color, allTokens)
      : color
    return [_color, position]
      .filter(Boolean)
      .join(' ')
  })
  return `:root { --${kebabCase(tokenPath.join(' '))}: ${gradientFunction}(${
    [angleShapePosition, ...stops].filter(Boolean).join(',')
  }); }`
}
