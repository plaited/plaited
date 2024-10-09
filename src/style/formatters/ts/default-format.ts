import type { Formatter } from '../formatters.types.ts'
import { camelCase } from '../../../utils/case.ts'
import { hasAlias } from '../has-alias.ts'
import { isValidAlias, getCssVar } from '../ts-utils.ts'

export const defaultFormat: Formatter = (token, { allTokens, tokenPath }) => {
  const { $value } = token
  if (hasAlias($value) && !isValidAlias($value, allTokens)) {
    return ''
  }
  return `export const ${camelCase(tokenPath.join(' '))} = ${getCssVar(tokenPath)}`
}
