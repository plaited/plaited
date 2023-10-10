import { createTemplate, Attrs, Template } from '@plaited/jsx'
import { ElementData } from './types.js'
import { getElement } from './register.js'

export const compileElementData = ({ $tag, $attrs: { children, slots, ...rest } = {} }:ElementData): Template => {
  const tag = getElement($tag)
  const _children =  Array.isArray(children)
    ? children
    :  [ children ].filter(Boolean)
  const _slots =  Array.isArray(slots)
    ? slots
    :  [ slots ].filter(Boolean)
  return createTemplate(
    tag, {
      ...(rest as Attrs),
      children: _children.map(child =>typeof child === 'string' ? child : compileElementData(child) ),
      slots: _slots.map(child => typeof child === 'string' ? child : compileElementData(child) ), 
    }
  )
}

// It takes the value of a data-target attribute and return all the events happening in it. minus the method identifier
// so iof the event was data-target="click->doSomething" it would return ["click"]
export const matchAllEvents = (str: string) => {
  const regexp = /(^\w+|(?:\s)\w+)(?:->)/g
  return [ ...str.matchAll(regexp) ].flatMap(([ , event ]) => event)
}

// returns the request/action name to connect our event binding to data-target="click->doSomething" it would return "doSomething"
// note triggers are separated by spaces in the attribute data-target="click->doSomething focus->somethingElse"
export const getTriggerKey = (
  e: Event,
  context: HTMLElement | SVGElement
): string => {
  const el = e.currentTarget === context
    ? context
    // check if closest slot from the element that invoked the event is the instances slot
    : e.composedPath().find(slot =>
      ((slot as Element)?.tagName === 'SLOT') && slot ===
          context
    )
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


export const traverseNodes = (node: Node, arr: Node[]) => {
  if (node.nodeType === 1) {
    if ((node as Element).hasAttribute('data-trigger') || node instanceof HTMLSlotElement) {
      arr.push(node)
    }
    if (node.hasChildNodes()) {
      const childNodes = node.childNodes
      const length = childNodes.length
      for (let i = 0; i < length; i++) {
        traverseNodes(childNodes[i], arr)
      }
    }
  }
}
