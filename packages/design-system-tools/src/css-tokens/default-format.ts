import { Formatter, PrimitiveArrayValue, PrimitiveValue } from '../types.js'
import { hasAlias } from '../resolve.js'
import { kebabCase } from '../../deps.js'

export const defaultFormat: Formatter<PrimitiveValue | PrimitiveArrayValue> = (
  { tokenPath, $value }
) => {
  if (hasAlias($value)) return ''
  if (Array.isArray($value)) {
    return (
      `:root { --${kebabCase(tokenPath.join(' '))}: ${$value.join(' ')}; }`
    )
  }
  return `:root { --${kebabCase(tokenPath.join(' '))}: ${$value}; }`
}
