import type { AliasValue } from '../types.js'

export const hasAlias = ($value: unknown): $value is AliasValue => {
  if (typeof $value !== 'string') return false
  const regex = /^(?:\{)([^"]*?)(?:\})$/
  return regex.test($value)
}
