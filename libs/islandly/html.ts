import { taggedWithPrimitives } from './utils.ts'
import { Primitive } from './types.ts'

/**
 * @description define your html with a tagged template literal
 * @returns a minimized html template string */
export const html = (
  strings: TemplateStringsArray,
  ...expressions: Array<Primitive | Primitive[]>
) => {
  const result = taggedWithPrimitives(strings, ...expressions)
  const tpl = result
    .trim()
    .replace(/[\s\n]+>/g, '>')
    .replace(
      /(<.*?)(?:\s+)(\w)|>\s+</g,
      (_, p1, p2) => p1 ? [p1, p2].join(' ') : '><',
    )
    .replace(/(>)(?:\s)(\S)|(\S)(?:\s)(<)/g, (_, p1, p2, p3, p4) => {
      return p1 ? [p1, p2].join('') : [p3, p4].join('')
    })
  return tpl
}
