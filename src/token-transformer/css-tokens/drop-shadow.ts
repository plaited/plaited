import { AliasValue, Formatter, DropShadowValue } from '../../token-types.ts'
import { resolveCSSVar, hasAlias } from '../resolve.ts'
import { kebabCase } from '../../deps.ts'


export const dropShadow:Formatter<DropShadowValue> = ({ tokenPath, $value, allTokens }) => {
  if (hasAlias($value)) return ''
  const { offsetX, offsetY, blur, color } = $value as Exclude<DropShadowValue, AliasValue>
  const val = [
    offsetX,
    offsetY,
    blur,
    color && hasAlias(color)
      ? resolveCSSVar(color, allTokens)
      : color,
  ].filter(Boolean)
  return  `:root { --${kebabCase(tokenPath.join(' '))}:drop-shadow(${val.join(' ')}); }`
}
