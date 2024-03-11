import { trueTypeOf, reduceWhitespace } from '@plaited/utils'

export type Primitive = null | undefined | number | string | boolean | bigint

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

/** Tagged template function for creating global css stylesheet */
export const css = (strings: TemplateStringsArray, ...expressions: Array<Primitive | Primitive[]>): string => {
  const result = taggedWithPrimitives(strings, ...expressions)
  return reduceWhitespace(result).trim()
}
