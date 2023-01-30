import { Formatter, BorderValue, AliasValue } from '../../token-types.ts'
import { resolveCSSVar, hasAlias } from '../resolve.ts'
import { kebabCase } from '../../deps.ts'
import { getRem } from '../get-rem.ts'
export const border:Formatter<BorderValue> = ({
  tokenPath,
  $value,
  allTokens,
  baseFontSize,
}) => {
  if (hasAlias($value)) return ''
  const { color, width, style } = $value as Exclude<BorderValue, AliasValue>
  const _color = hasAlias(color) ? resolveCSSVar(color, allTokens) : color
  const _width = typeof width === 'number'
    ? getRem(width, baseFontSize)
    : resolveCSSVar(`${width}`, allTokens)
  return  `:root { --${kebabCase(tokenPath.join(' '))}:${_width} ${style} ${_color}; }`
}
