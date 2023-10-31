import { TransitionValue, TransitionToken, AliasValue, DesignTokenGroup } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule } from '../utils.js'

const transitionCallback = (allTokens: DesignTokenGroup) => ($value: Exclude<TransitionValue, AliasValue>) => {
  const { duration, delay, timingFunction } = $value
  return [
    hasAlias(duration) ? resolveCSSVar(duration, allTokens) : duration,
    delay && hasAlias(delay) ? resolveCSSVar(delay, allTokens) : delay,
    timingFunction && typeof timingFunction !== 'string'
      ? `${timingFunction.function}(${timingFunction.values.map((v) => v.toString()).join(' ')})`
      : timingFunction,
  ]
    .filter(Boolean)
    .join(' ')
}

export const transition: Formatter<TransitionToken> = (
  token,
  { allTokens, tokenPath, baseFontSize: _, ...contexts },
) => {
  const cb = transitionCallback(allTokens)
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<TransitionToken, TransitionValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: cb($value) })
  }
  const toRet: string[] = []
  if (isContextualToken<TransitionToken, TransitionValue>(token)) {
    const {
      $value,
      $extensions: { 'plaited-context': $context },
    } = token
    for (const id in $value) {
      const contextValue = $value[id]
      if (hasAlias(contextValue)) {
        toRet.push(getRule({ prop, value: resolveCSSVar(contextValue, allTokens) }))
        continue
      }
      const context = { type: $context, id }
      if (isValidContext({ context, ...contexts })) {
        toRet.push(getRule({ prop, value: cb(contextValue), context, ...contexts }))
      }
    }
  }
  return toRet.join('\n')
}
