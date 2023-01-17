import { Formatter, BorderValue, AliasValue } from '../../types.js'
import { hasAlias, resolveCSSVar } from '../resolve'
import { kebabCase } from 'lodash-es'
import { dimension } from './dimension.js'

export const border:Formatter<BorderValue> = ({
  tokenPath,
  $value,
  _allTokens,
  baseFontSize,
}) => {
  const aliased = typeof $value === 'string' && hasAlias($value)
  if (aliased) return ''
  const { color, width, style } = $value as Exclude<BorderValue, AliasValue>
  const _color = hasAlias(color) ? resolveCSSVar(color, _allTokens) : color
  const _width = hasAlias(width.toString())
    ? resolveCSSVar(`${width}`, _allTokens)
    : dimension({ $value: width, tokenPath, _allTokens, baseFontSize })
  const _style = hasAlias(style) ? resolveCSSVar(style, _allTokens) : style
  return  `--${kebabCase(tokenPath.join(' '))} : ${_width} ${_style} ${_color}`
}
