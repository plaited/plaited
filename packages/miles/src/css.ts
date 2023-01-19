/**
 * Fork of https://github.com/sgtpep/csstag
 */

import postcss, { Processor } from'postcss'
import modulesLocalByDefault from 'postcss-modules-local-by-default'
//@ts-ignore: don't need types for this
import modulesParser from 'postcss-modules-parser'
import modulesScope from 'postcss-modules-scope'
import nesting from 'postcss-nesting'
import { trueTypeOf, escape, hashString, base64 } from '@plaited/utils'

type Primitive = number |
  string |
  boolean |
  undefined |
  null |
  void 

const isTruthy = (val:Primitive) => trueTypeOf(val) === 'string' ||
  trueTypeOf(val) === 'number'


let instance: Processor | undefined
export const css = (strings: TemplateStringsArray, ...values: Array<Primitive | Primitive[]>) => {
  /**
   * Same basic logic as html without minimization
   */
  const { raw } = strings
  let style = values.reduce<string>((acc, subst, i) => {
    acc += raw[i]
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
  style += raw[raw.length - 1]
  /**
   * Fork of https://github.com/sgtpep/csstag
   * PostCSS step we allow nesting and output css modules
   */
  let styles:Record<string, string> = {}
  let stylesheet = ''
  instance ||
    (instance = postcss([
      nesting,
      modulesLocalByDefault,
      modulesScope({
        generateScopedName: (name, path) => `${name}___${base64(`${hashString(style)}`).replace(/[./=]/g, '')}`,
      }),
      modulesParser,
    ]))
 

  const result = instance.process(style, { from: '', to: '' })
  stylesheet = result.toString()
  //@ts-ignore: added to root by modulesParser which does not have typing
  styles = result.root.tokens
  return {
    styles,
    stylesheet,
  }
}
