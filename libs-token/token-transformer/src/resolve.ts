/**
 * Utility helpers for resolving aliased values in tokens object
 */

import { DesignToken, DesignTokenGroup, AliasValue } from '@plaited/token-types'
import { camelCase, kebabCase } from '@plaited/utils'

const getResolvedValue = (path: string[], tokens: DesignTokenGroup | undefined): DesignToken | undefined => {
  let toRet = { ...tokens }
  for (let i = 0, len = path.length; i < len; i++) {
    const key = path[i]
    const exist = key in toRet
    if (exist) {
      //@ts-ignore: error handling
      toRet = toRet[key]
    }
    !exist && console.error('\x1b[36m', `\ninvalid path — token(${path.join('.')})`, '\x1b[31m', '\x1b[0m')
  }
  //@ts-ignore: dynamic type checking
  if (Object.hasOwn(toRet, '$value')) return toRet
  console.error('\x1b[36m', `\nincomplete path — token(${path.join('.')})`, '\x1b[0m')
  return
}

export const hasAlias = ($value: unknown): $value is AliasValue => {
  if (typeof $value !== 'string') return false
  const regex = /^(?:\{)([^"]*?)(?:\})$/
  return regex.test($value)
}

export const resolve = (
  value: string,
  allTokens: DesignTokenGroup | undefined,
): [DesignToken, string[]] | undefined => {
  const path: string[] = value.slice(1, value.length - 1).split('.')
  const val = getResolvedValue(path, allTokens)
  // Need to dynamically check that val is itself not an alias
  if (val) {
    return [val, path]
  }
}

export const resolveCSSVar = (value: string, allTokens: DesignTokenGroup | undefined) => {
  const res = resolve(value, allTokens)
  if (!res) return ''
  const [, path] = res
  return `var(--${kebabCase(path.join(' '))})`
}

export const resolveTSVar = (value: string, allTokens: DesignTokenGroup) => {
  const res = resolve(value, allTokens)
  if (!res) return ''
  const [, path] = res
  return camelCase(path.join(' '))
}
