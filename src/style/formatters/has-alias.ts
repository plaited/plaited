import type { AliasValue } from '../token.types.ts'

export const hasAlias = ($value: unknown): $value is AliasValue => {
  if (typeof $value !== 'string') return false
  const regex = /^(?:\{)([^"]*?)(?:\})$/
  return regex.test($value)
}
