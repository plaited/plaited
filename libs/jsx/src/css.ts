import { hashString, trueTypeOf, reduceWhitespace } from '../../../libs-cross-framework/utils/dist/index.js'

export type Primitive = null | undefined | number | string | boolean | bigint

type ClassObject = {
  content: string
}

const isTruthy = (val: Primitive) => trueTypeOf(val) === 'string' || trueTypeOf(val) === 'number'

const taggedWithPrimitives = (strings: TemplateStringsArray, ...expressions: Array<Primitive | Primitive[]>) => {
  const { raw } = strings
  let result = expressions.reduce<string>((acc, subst, i) => {
    acc += reduceWhitespace(raw[i])
    let filteredSubst =
      Array.isArray(subst) ? subst.filter(isTruthy).join('')
      : isTruthy(subst) ? subst
      : ''
    if (acc.endsWith('$')) {
      filteredSubst = escape(filteredSubst as string)
      acc = acc.slice(0, -1)
    }
    return acc + filteredSubst
  }, '')
  return (result += reduceWhitespace(raw[raw.length - 1]))
}

const tokenize = (css: string): (string | ClassObject)[] => {
  const regex = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/gm
  const matches: (string | ClassObject)[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(css)) !== null) {
    // Add any non-matching text to the array
    if (match.index > lastIndex) {
      matches.push(css.substring(lastIndex, match.index))
    }
    // Add the class object to the array
    matches.push({ content: match[1] })
    // Update the last index to the end of the match
    lastIndex = regex.lastIndex
  }

  // Add any remaining non-matching text to the array
  if (lastIndex < css.length) {
    matches.push(css.substring(lastIndex))
  }
  return matches
}

/** tagged template function for creating css module style styles and classNames objects */
export const css = (
  strings: TemplateStringsArray,
  ...expressions: Array<Primitive | Primitive[]>
): {
  $stylesheet: string
  [key: string]: string
} => {
  const result = taggedWithPrimitives(strings, ...expressions)
  const suffix = btoa(`${hashString(result)}`).replace(/[+/=]/g, '')
  const tokens = tokenize(result)
  const classes = new Map<string, string>()
  const addClass = (key: string) => {
    const value = `${key}_${suffix.slice(0, 6)}`
    const toRet = `.${value}`
    if (classes.has(key)) return toRet
    classes.set(key, value)
    return toRet
  }
  const styles =
    tokens?.map((token) => (typeof token === 'string' ? reduceWhitespace(token) : addClass(token.content))).join('') ||
    ''
  return Object.freeze({
    ...Object.fromEntries(classes),
    $stylesheet: reduceWhitespace(styles).trim(),
  })
}
