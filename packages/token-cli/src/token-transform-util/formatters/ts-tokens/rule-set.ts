import { Formatter, FlexValue, GridValue, TypographyValue, AliasValue } from '../../types.js'
import { resolveTSVar, hasAlias } from '../resolve.js'
import { camelCase } from 'lodash-es'

type $ValueObject = Exclude<FlexValue, AliasValue>
type RuleSetValue = FlexValue| GridValue| TypographyValue
export const ruleSet:Formatter<RuleSetValue> =({
  tokenPath,
  $value,
  _allTokens,
}) => {
  if(hasAlias($value)) {
    return  `export const ${camelCase(tokenPath.join(' '))} = ${resolveTSVar($value as  AliasValue, _allTokens)}`
  }
  const toRet: Record<string, string> = {}
  for(const key in $value as $ValueObject) {
    toRet[key] = resolveTSVar($value[key as keyof RuleSetValue], _allTokens )
  }
  return  `export const ${camelCase(tokenPath.join(' '))} = ${JSON.stringify(toRet, null, 2)}`
}
