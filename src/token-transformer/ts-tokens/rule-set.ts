import { Formatter, FlexValue, GridValue, TypographyValue, AliasValue } from '../../token-types.ts'
import { resolveTSVar, hasAlias } from '../resolve.ts'
import { camelCase } from '../../deps.ts'

type $ValueObject = Exclude<FlexValue, AliasValue>
type RuleSetValue = FlexValue| GridValue| TypographyValue
export const ruleSet:Formatter<RuleSetValue> =({
  tokenPath,
  $value,
  allTokens,
}) => {
  if(hasAlias($value)) {
    return  `export const ${camelCase(tokenPath.join(' '))} = ${resolveTSVar($value as  AliasValue, allTokens)}`
  }
  const toRet = Object.entries($value).map(([ key, val ]) => `  ${key}: ${resolveTSVar(val, allTokens)},`)
  return  [ `export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}' ].join('\n')
}