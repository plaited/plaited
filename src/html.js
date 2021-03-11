import {trueTypeOf} from '@plaited/utils'
/**
 * @description
 * Tagged template function for making strings of html.
 * Good for either server side rendering or insid e web components
 * in conjunction with or without tpl function
 * @param {string} strings
 * @param {expression}
 * @return {DocumentFragment}
 */

const reduceWhitespace = str => str.replace(/(\s\s+|\n)/g, ' ')
const primitiveValues = {
  string: true,
  boolean: true,
  number: true,
  bigint: true,
}
const isPrimitive = val => primitiveValues[trueTypeOf(val)] || false

export const camelCaseToDash = str => str.replace(
  /([a-zA-Z])(?=[A-Z])/g,
  '$1-',
).toLowerCase()

export const html = (strings, ...expressions) => {
  /**
   * @constant
   * @type {{raw:[...string]}}
   */
  const {raw} = strings
  const result = expressions.reduce((acc, cur, i) => {
    acc.push(reduceWhitespace(raw[i]))
    const string = Array.isArray(cur) 
      ? cur.filter(isPrimitive).join('') // need to propably map here
      // : trueTypeOf(cur) === 'object'
      // ? spreadAttrs(acc, cur)
      : isPrimitive(cur) 
      ? cur
      :''
    acc.push(string)
    return acc
  }, [])
  result.push(reduceWhitespace(raw[raw.length - 1]))
  const tpl = result
    .join('')
    .trim()
    .replace(/\s>/g, '>')
    .replace(/>\s</g, '><')
    .replace(/(>)(\s)(\S)/g, (match, p1, p2, p3) => [p1, p3].join(''))
    .replace(/(\S)(\s)(<)/g, (match, p1, p2, p3) => [p1, p3].join(''))
  // .replace(/[\t\r\n]+/g, ' ')
  return  tpl
}
