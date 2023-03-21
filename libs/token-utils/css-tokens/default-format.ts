import { Formatter, PrimitiveArrayValue, PrimitiveValue } from '../types.ts'
import { hasAlias } from '../resolve.ts'
import { kebabCase } from '../../deps.ts'

export const defaultFormat: Formatter<PrimitiveValue | PrimitiveArrayValue> = (
  { tokenPath, $value },
) => {
  if (hasAlias($value)) return ''
  if (Array.isArray($value)) {
    return (
      `:root { --${kebabCase(tokenPath.join(' '))}: ${$value.join(' ')}; }`
    )
  }
  return `:root { --${kebabCase(tokenPath.join(' '))}: ${$value}; }`
}
