import { AliasValue, Formatter, DropShadowValue } from '../../types.js'
import { resolveCSSVar, hasAlias } from '../resolve.js'
import { kebabCase } from 'lodash-es'


export const dropShadow:Formatter<DropShadowValue> = ({ tokenPath, $value, _allTokens }) => {
  if (hasAlias($value)) return ''
  const { offsetX, offsetY, blur, color } = $value as Exclude<DropShadowValue, AliasValue>
  const val = [
    offsetX,
    offsetY,
    blur,
    color && hasAlias(color)
      ? resolveCSSVar(color, _allTokens)
      : color,
  ].filter(Boolean)
  return  `:root { --${kebabCase(tokenPath.join(' '))}:drop-shadow(${val.join(' ')}); }`
}
