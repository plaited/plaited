import { AliasValue, BorderValue, Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '../../deps.js'
import { getRem } from '../get-rem.js'
export const border: Formatter<BorderValue> = ({
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
  return `:root { --${
    kebabCase(tokenPath.join(' '))
  }:${_width} ${style} ${_color}; }`
}
