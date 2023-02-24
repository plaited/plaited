import { reduceWhitespace, taggedWithPrimitives } from './utils.ts'
import { hashString } from '../utils/hash.ts'
import { Primitive } from './types.ts'

type ClassObject = {
  content: string
}

const tokenize = (
  css: string,
): (string | ClassObject)[] => {
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
) => {
  const result = taggedWithPrimitives(strings, ...expressions)
  const suffix = btoa(`${hashString(result)}`).replace(/[+/=]/g, '')
  const tokens = tokenize(result)
  const classes = new Map<string, string>()
  const addClass = (key: string) => {
    const hash = `${key}_${suffix}`
    if (classes.has(key)) return `.${hash}`
    classes.set(key, hash)
    return `.${hash}`
  }
  const styles =
    tokens?.map((token) =>
      typeof token === 'string'
        ? reduceWhitespace(token)
        : addClass(token.content)
    ).join('') || ''

  return {
    classes: Object.fromEntries(classes),
    styles: reduceWhitespace(styles).trim(),
  }
}
