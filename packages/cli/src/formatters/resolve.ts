import { DesignTokenGroup, DesignToken } from '../types'
import { kebabCase, toPath } from 'lodash-es'

const getResolvedValue = (
  path: string[], tokens: DesignTokenGroup
): DesignToken | undefined => {
  let toRet = { ...tokens }
  for (let i = 0, len = path.length; i < len; i++) {
    const key = path[i]
    if (key in toRet) {
      //@ts-ignore: error handling
      toRet = toRet[key]
    } else {
      console.error(
        '\x1b[36m',
        `\ninvalid path — token(${path.join(',')})`,
        '\x1b[31m',
        '\x1b[0m'
      )
      return
    }
  }
  if (toRet?.hasOwnProperty('$value')) {
    //@ts-ignore: dynamic type checking
    return toRet
  }
  console.error(
    '\x1b[36m',
    `\nincomplete path — token(${path.join(',')})`,
    '\x1b[0m'
  )
  return
}

export const hasAlias = (str:string) => {
  const regex = /^(?:\{)([^"]*?)(?:\})$/
  return regex.test(str)
}

export const resolve = (
  value: string,
  _allTokens: DesignTokenGroup
): [DesignToken, string[]] | undefined => {
  const path: string[] = value.split('.')
  const val = getResolvedValue(path, _allTokens)
  // Need to dynamically check that val is itself not an alias
  if(val){
    return [ val, path ]
  }
}

export const resolveCSSVar = (
  value: string,
  _allTokens: DesignTokenGroup
) => {
  const res = resolve(value, _allTokens)
  if(!res) return ''
  const [ , path ] = res
  return `var(--${kebabCase(path.join(' '))})`
}
