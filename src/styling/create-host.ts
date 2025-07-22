import { CSS_RESERVED_KEYS } from './styling.constants.js'
import type { CreateHostParams, StylesObjectWithoutClass } from './styling.types.js'
import { isPrimitive, caseProp } from './styling.utils.js'

export const createHost = (props: CreateHostParams): StylesObjectWithoutClass => {
  const arr: string[] = []
  for (const prop in props) {
    const value = props[prop]
    if (isPrimitive(value)) {
      arr.push(`:host{${caseProp(prop)}:${value};}`)
      continue
    }
    for (const selector in value) {
      if (selector === CSS_RESERVED_KEYS.$default) {
        arr.push(`:host{${caseProp(prop)}:${value[selector]};}`)
        continue
      }
      arr.push(`:host(${selector}){${caseProp(prop)}:${value[selector]};}`)
    }
  }
  return {
    stylesheet: [...arr],
  }
}

/**
 * For a given part we can
 * 1. directyly write styles
 * 2. we can assign variable values
 * 3. A components can have variable values assign to it. A part utility can be used to
 * create vars that are asssigned to different props simply enough. The difference here is that
 * this flips some things and takes us more into programming than pure declarations to really work
 * It would actually be a function that receives a part identifier maybe??
 */
