import type { CompositeToken } from '../../token.types.ts'
import type { Formatter } from '../formatters.types.ts'
import { camelCase } from '../../../utils/case.ts'
import { hasAlias } from '../has-alias.ts'
import { resolveTSVar, isValidAlias } from '../ts-utils.ts'

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
