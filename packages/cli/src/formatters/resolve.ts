import { DesignTokenGroup, DesignToken } from '../types'

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
  if(val){
    return [ val, path ]
  }
}
