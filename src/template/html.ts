import { trueTypeOf, escape } from '../utils.ts'

type Primitive = number |
  string |
  boolean |
  undefined |
  null |
  void 

const reduceWhitespace = (str: string) => str.replace(/(\s\s+|\n)/g, ' ')

const isTruthy = (val:Primitive) => trueTypeOf(val) === 'string' ||
  trueTypeOf(val) === 'number'

/** @returns a minimized html template string */
export const html = (strings: TemplateStringsArray, ...expressions: Array<Primitive | Primitive[]>) => {
  const { raw } = strings
  let result = expressions.reduce<string>((acc, subst, i) => {
    acc += reduceWhitespace(raw[i])
    let filteredSubst = Array.isArray(subst)
      ? subst.filter(isTruthy).join('')
      : isTruthy(subst)
        ? subst
        : ''
    if (acc.endsWith('$')) {
      filteredSubst = escape(filteredSubst as string)
      acc = acc.slice(0, -1)
    }
    return acc + filteredSubst
  }, '')
  result += reduceWhitespace(raw[raw.length - 1])
  const tpl = result
    .trim()
    .replace(/[\s\n]+>/g, '>')
    .replace(/(<.*?)(?:\s+)(\w)|>\s+</g, (match, p1, p2) => p1 ? [ p1, p2 ].join(' ') : '><')
    .replace(/(>)(?:\s)(\S)|(\S)(?:\s)(<)/g, (match, p1, p2, p3, p4) => {
      return p1 
        ? [ p1, p2 ].join('')
        : [ p3, p4 ].join('')
    })
  return tpl
}
