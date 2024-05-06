/**
 * Utility helpers for resolving aliased values in tokens object
 */

import { DesignToken, DesignTokenGroup } from '../types.js'

const getResolvedValue = (path: string[], tokens: DesignTokenGroup | undefined): DesignToken | undefined => {
  let toRet = { ...tokens }
  for (let i = 0, len = path.length; i < len; i++) {
    const key = path[i]
    const exist = key in toRet
    if (exist) {
      //@ts-ignore: dynamic error handling
      toRet = toRet[key]
    }
    !exist && console.error(`Invalid token alias: {${path.join(".")}}`);
  }
  //@ts-ignore: dynamic type checking
  if (Object.hasOwn(toRet, '$value')) return toRet
}

export const resolveAlias = (
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