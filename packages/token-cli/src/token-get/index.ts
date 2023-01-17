import { DesignTokenGroup } from '../types.js'

const regex = /(?:token\()([^"]*?)(?:\))/g

type Source = {
  input: {
    from: string
  },
  start: {
    line: number,
    column: number,
  },
  end: {
    line: number,
    column: number,
  }
}


const resolve = ({ path, map, source }:{path: string[], map: DesignTokenGroup, source: Source}) => {
  let toRet = { ...map }
  for (let i = 0, len = path.length; i < len; i++) {
    const key = path[i].trim()
    if (key in toRet) {
      // @ts-ignore: recursive assignment 
      toRet = toRet[key]
    } else {
      console.error(
        '\x1b[36m',
        `\ntoken-get: invalid path — token(${path.join(',')})`,
        '\x1b[31m',
        `\n${source.input.from}:${source.end.line}:${source.end.column}\n`,
        '\x1b[0m'
      )
      return
    }
  }
  if(typeof toRet === 'string') {
    return toRet
  } else {
    console.error(
      '\x1b[36m',
      `\ntoken-get: incomplete path — token(${path.join(',')}) => ${JSON.stringify(toRet, null, 2)}`,
      '\x1b[31m',
      `\n${source.input.from}:${source.start.line}:${source.start.column}\n`,
      '\x1b[0m'
    )
    return
  }
}

const processValue = ({ value, map, source }:{ value: string, map: DesignTokenGroup, source: Source }) => {
  return value.replace(regex, (_, p1) => resolve({ path: p1.split(','), map, source }) ||value)
}

export const tokensGet = (map:DesignTokenGroup) => {
  return {
    postcssPlugin: 'postcss-plaited-token-get',

    Declaration(decl: { value?: string, source: Source}) {
      const { value, source } = decl
      if (value && regex.test(value)) {
        decl.value = processValue({ value, map, source })
      }
    },

    AtRule(atRule: { params?: string, source: Source}) {
      const { params, source } = atRule
      if (params && regex.test(params)) {
        atRule.params = processValue({ value: params, map, source })
      }
    },
  }
}

tokensGet.postcss = true
