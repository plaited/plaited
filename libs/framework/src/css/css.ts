import { trueTypeOf, reduceWhitespace } from '@plaited/utils'

export type Primitive = null | undefined | number | string | boolean | bigint

const isTruthy = (val: Primitive): val is string | number =>
  trueTypeOf(val) === 'string' || trueTypeOf(val) === 'number'

/** Tagged template function for creating global css stylesheet */
export const css = (
  strings: TemplateStringsArray,
  ...expressions: Array<Primitive | Primitive[]>
): { stylesheet: string } => {
  const { raw } = strings
  let result = expressions.reduce<string>((acc, subst, i) => {
    acc += reduceWhitespace(raw[i])
    let filteredSubst =
      Array.isArray(subst) ? subst.filter(isTruthy).join('')
      : isTruthy(subst) ? `${subst}`
      : ''
    if (acc.endsWith('$')) {
      filteredSubst = escape(filteredSubst)
      acc = acc.slice(0, -1)
    }
    return acc + filteredSubst
  }, '')
  return Object.freeze({ stylesheet: (result += reduceWhitespace(raw[raw.length - 1])) })
}
