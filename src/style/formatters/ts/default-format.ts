import type { Formatter } from '../formatters.types.js'
import { camelCase } from '../../../utils/case.js'
import { hasAlias } from '../has-alias.js'
import { isValidAlias, getCssVar } from '../ts-utils.js'

export const defaultFormat: Formatter = (token, { allTokens, tokenPath }) => {
  const { $value } = token
  if (hasAlias($value) && !isValidAlias($value, allTokens)) {
    return ''
  }
  return `export const ${camelCase(tokenPath.join(' '))} = ${getCssVar(tokenPath)}`
}
