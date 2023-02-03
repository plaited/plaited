import { AliasValue, Formatter, TransitionValue } from '../../token-types.ts'
import { hasAlias, resolveCSSVar } from '../resolve.ts'
import { kebabCase } from '../../deps.ts'

export const transition: Formatter<TransitionValue> = (
  { tokenPath, $value, allTokens },
) => {
  if (hasAlias($value)) return ''
  const { duration, delay, timingFunction } = $value as Exclude<
    TransitionValue,
    AliasValue
  >
  const val = [
    hasAlias(duration) ? resolveCSSVar(duration, allTokens) : duration,
    delay && hasAlias(delay) ? resolveCSSVar(delay, allTokens) : delay,
    timingFunction && typeof timingFunction !== 'string'
      ? `${timingFunction.function}(${
        timingFunction.values.map((v) => v.toString()).join(' ')
      })`
      : timingFunction,
  ]
  return `:root { --${kebabCase(tokenPath.join(' '))}: ${
    val.filter(Boolean).join(' ')
  }); }`
}
