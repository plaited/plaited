import {
  AliasValue,
  FlexValue,
  Formatter,
  GridValue,
  TypographyValue,
} from '../types.js'
import { hasAlias, resolveTSVar } from '../resolve.js'
import { camelCase } from 'lodash-es'

type RuleSetValue = FlexValue | GridValue | TypographyValue;
export const ruleSet: Formatter<RuleSetValue> = ({
  tokenPath,
  $value,
  allTokens,
}) => {
  if (hasAlias($value)) {
    return `export const ${camelCase(tokenPath.join(' '))} = ${
      resolveTSVar($value as AliasValue, allTokens)
    }`
  }
  const toRet = Object.entries($value).map(([ key, val ]) =>
    `  ${key}: ${resolveTSVar(val, allTokens)},`
  )
  return [ `export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}' ]
    .join('\n')
}
