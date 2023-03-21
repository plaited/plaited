import { Primitive } from './types.ts'
import { escape, trueTypeOf } from '../utils/mod.ts'

// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
export const matchAllEvents = (str: string) => {
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [...str.matchAll(regexp)].flatMap(([, event]) => event)
}

// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
export const getTriggerKey = (evt: Event) => {
  const el = evt.currentTarget
  const type = evt.type
  const pre = `${type}->`
  //@ts-ignore: will be HTMLOrSVGElement
  return el.dataset.trigger
    .trim()
    .split(/\s+/)
    .find((str: string) => str.includes(pre))
    .replace(pre, '')
}

// Takes a list of nodes added when mutation observer change happened and filters our the ones with triggers
export const filterAddedNodes = (nodes: NodeList) => {
  const elements: (HTMLElement | SVGElement)[] = []
  nodes.forEach((node) => {
    if (node instanceof HTMLSlotElement) return
    if (
      node instanceof HTMLElement ||
      node instanceof SVGElement
    ) {
      if (node.hasAttribute('slot')) return
      node.dataset.trigger && elements.push(node)
    }
  })
  return elements
}

// Get slotted elements that have the data trigger atrtribute and add them to
export const filterSlottedElements = (slot: HTMLSlotElement) => {
  const elements: (HTMLElement | SVGElement)[] = []
  for (const el of slot.assignedElements()) {
    if (
      el instanceof HTMLElement ||
      el instanceof SVGElement
    ) {
      el.dataset.trigger && elements.push(el)
    }
  }
  return elements
}

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
