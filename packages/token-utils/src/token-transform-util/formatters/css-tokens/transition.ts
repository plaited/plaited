import { AliasValue, Formatter, TransitionValue } from '../../../types.js'
import { resolveCSSVar, hasAlias } from '../resolve.js'
import { kebabCase } from 'lodash-es'

export const transition:Formatter<TransitionValue> = ({ tokenPath, $value, allTokens }) => {
  if (hasAlias($value)) return ''
  const { duration, delay, timingFunction } = $value as Exclude<TransitionValue, AliasValue>
  const val = [
    hasAlias(duration)
      ? resolveCSSVar(duration, allTokens) 
      : duration,
    delay && hasAlias(delay)
      ? resolveCSSVar(delay, allTokens)
      : delay,
    timingFunction && typeof timingFunction !== 'string'
      ? `${timingFunction.function}(${timingFunction.values.map(v => v.toString()).join(' ')})`
      : timingFunction,
  ]
  return `:root { --${kebabCase(tokenPath.join(' '))}: ${val.filter(Boolean).join(' ')}); }`
}
