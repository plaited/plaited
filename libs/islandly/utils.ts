import { escape, trueTypeOf } from '../utils/mod.ts'

export type Primitive =
  | number
  | string
  | boolean
  | undefined
  | null
  | void

// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
export const matchAllEvents = (str: string) => {
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [...str.matchAll(regexp)].flatMap(([, event]) => event)
}

// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
export const getTriggerKey = (
  e: Event,
  context: HTMLElement | SVGElement,
): string => {
  const el = e.currentTarget === context
    ? context
    // check if closest slot from the element that invoked the event is the instances slot
    : e.composedPath().find((slot) => slot instanceof HTMLSlotElement) ===
        context
    ? context
    : undefined

  if (!el) return ''
  const pre = `${e.type}->`
  const trigger = el.dataset.trigger ?? ''
  const key = trigger.trim().split(/\s+/).find((str: string) =>
    str.includes(pre)
  )
  return key ? key.replace(pre, '') : ''
}

// We only support binding and querying named slots that are not also nested slots
export const canUseSlot = (node: HTMLSlotElement) =>
  !node.hasAttribute('slot') && node.hasAttribute('name')

export const reduceWhitespace = (str: string) => str.replace(/(\s\s+|\n)/g, ' ')

const isTruthy = (val: Primitive) =>
  trueTypeOf(val) === 'string' ||
  trueTypeOf(val) === 'number'

export const taggedWithPrimitives = (
  strings: TemplateStringsArray,
  ...expressions: Array<Primitive | Primitive[]>
) => {
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
  return result += reduceWhitespace(raw[raw.length - 1])
}
