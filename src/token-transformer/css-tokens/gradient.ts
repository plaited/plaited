import { AliasValue, Formatter, GradientValue } from '../../token-types.ts'
import { hasAlias, resolveCSSVar } from '../resolve.ts'
import { kebabCase } from '../../deps.ts'

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
