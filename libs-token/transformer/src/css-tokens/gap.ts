import { GapValue, GapToken, AliasValue } from '@plaited/token-types'
import { Formatter } from '../types.js'
import { hasAlias, resolveCSSVar } from '../resolve.js'
import { kebabCase } from '@plaited/utils'
import { isContextualToken, isStaticToken, isValidContext } from '../context-guard.js'
import { getRule, getRem } from '../utils.js'

const gapCallback = (baseFontSize: number) => ($value: Exclude<GapValue, AliasValue>) =>
  typeof $value === 'string' ? $value : getRem($value, baseFontSize)

export const gap: Formatter<GapToken> = (token, { allTokens, tokenPath, baseFontSize, ...contexts }) => {
  const cb = gapCallback(baseFontSize)
  const prop = kebabCase(tokenPath.join(' '))
  if (isStaticToken<GapToken, GapValue>(token)) {
    const { $value } = token
    if (hasAlias($value)) return ''
    return getRule({ prop, value: cb($value) })
  }
  const toRet: string[] = []
  if (isContextualToken<GapToken, GapValue>(token)) {
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
        toRet.push(
          getRule({
            prop,
            value: cb(contextValue),
            context,
            ...contexts,
          }),
        )
      }
    }
  }
  return toRet.join('\n')
}
