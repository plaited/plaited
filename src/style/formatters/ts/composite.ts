import type { CompositeToken } from '../../token.types.js'
import type { Formatter } from '../formatters.types.js'
import { camelCase } from '../../../utils/case.js'
import { hasAlias } from '../has-alias.js'
import { resolveTSVar, isValidAlias } from '../ts-utils.js'

export const composite: Formatter<CompositeToken> = (token, { tokenPath, allTokens }) => {
  const { $value } = token
  if (hasAlias($value) && !isValidAlias($value, allTokens)) {
    return ''
  }
  if (hasAlias($value)) {
    return `export const ${camelCase(tokenPath.join(' '))} = ${resolveTSVar($value, allTokens)}`
  }
  const toRet: string[] = []
  for (const key in $value) {
    const val = $value[key]
    if (isValidAlias(val, allTokens)) {
      toRet.push(`  ${key}: ${resolveTSVar(val, allTokens)},`)
    }
  }
  return [`export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}'].join('\n')
}
